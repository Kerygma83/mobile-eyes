// Original-Intro (INTRO_E.OVL aus den Spieldaten) im Browser: ein kleiner 8086-Interpreter mit den
// wenigen DOS-, BIOS- und VGA-Diensten, die das Programm braucht. Nicht im Spiel enthalten; die Datei
// liefert der Nutzer mit seinen Spieldaten (GOG-Installer).
//
// Im Original startet SCHICK.BAT erst INTRO.EXE, das den Musiktreiber lädt und INTRO_E.OVL ausführt
// (Turbo Pascal, Modus 13h). Musik fordert das Intro über int 80h an (ax=1: Stück bx, ax=2: Stopp,
// ax=3: Abfrage); hier meldet introStarten() das über optionen.musik.
//
// Zeit ist virtuell: der Prozessor rechnet CPU_HZ Befehle je Sekunde, der Zeitgeber (PIT) feuert nach
// virtueller Zeit; die Seite gleicht die virtuelle mit der echten Zeit je Bild ab.
'use strict';

(function (global) {
	const CPU_HZ = 25_000_000;          // virtuelle Befehle je Sekunde (etwa ein 486; die Abläufe hängen nicht daran)
	const PIT_HZ = 1193182;
	const VSYNC_HZ = 70;
	const SEG_LADEN = 0x1000;          // PSP hier, Programm ab 0x1010
	const BIOS_SEG = 0xf000;

	class Intro {
		constructor(dateien, optionen = {}) {
			this.dateien = new Map(Object.entries(dateien).map(([n, d]) => [n.toUpperCase(), d]));
			this.optionen = optionen;
			this.m = new Uint8Array(0x110000);
			this.r = new Uint16Array(8);     // ax cx dx bx sp bp si di
			this.s = new Uint16Array(4);     // es cs ss ds
			this.ip = 0; this.fl = 0x0202;
			this.befehle = 0;                // ausgeführte Befehle (virtuelle Zeit)
			this.letzte3da = -1e9; this.letzteTastenfrage = -1e9;
			this.schreibe = 0; this.schleife = { ip: -1, cs: -1, befehle: 0, schreibe: 0, regs: new Uint16Array(12) };
			this.palette = new Uint8Array(768);
			this.dacSchreib = 0; this.dacLese = 0; this.dacTeil = 0;
			this.pitTeiler = 65536; this.pitZugriff = 3; this.pitLo = null; this.pitNaechst = 0;
			this.pitModus = 3; this.pitStart = 0; this.pitLatch = null; this.pitLeseHi = false;
			this.pitKanal = 0;
			this.irqWartet = false; this.irqAktiv = false; this.picMaske = 0;
			this.tasten = [];
			this.handles = new Map(); this.naechstesHandle = 5;
			this.speicherFrei = 0;           // erster freier Absatz (DOS-Speicher)
			this.beendet = false; this.fehler = null; this.angehalten = false;
			this.log = optionen.log || (() => {});
			this.biosEinrichten();
			this.laden(optionen.programm || 'INTRO_E.OVL', optionen.argumente || '');
			if (optionen.einDurchlauf) this.durchlaufMarke();
		}

		// Das Original wiederholt das Intro (Titel, Szenen, Abspann) endlos bis zu einer Taste. Der Sprung zurück
		// an den Anfang der Schleife (Hauptprogramm 0x4008: call 0x3459, Titel) wird zu einem Dienst, der beim
		// zweiten Mal das Programm beendet.
		durchlaufMarke() {
			const a = (this.s[1] << 4) + 0x4008;
			if (this.m[a] !== 0xe8 || ((this.m[a + 1] | (this.m[a + 2] << 8)) + 0x400b & 0xffff) !== 0x3459) return;
			this.m[a] = 0xf1; this.m[a + 1] = 0xfe; this.m[a + 2] = 0x90;
			this.durchlaeufe = 0;
		}

		// ---------- Speicher ----------
		lin(seg, off) { return ((seg << 4) + (off & 0xffff)) & 0xfffff; }
		rb(seg, off) { return this.m[this.lin(seg, off)]; }
		rw(seg, off) { return this.m[this.lin(seg, off)] | (this.m[this.lin(seg, off + 1)] << 8); }
		wb(seg, off, v) { this.m[this.lin(seg, off)] = v; this.schreibe++; }
		ww(seg, off, v) { this.m[this.lin(seg, off)] = v & 0xff; this.m[this.lin(seg, off + 1)] = (v >> 8) & 0xff; this.schreibe++; }

		// ---------- BIOS und DOS: Vektoren zeigen auf Stummel F1 nn CF (JS-Dienst, dann IRET) ----------
		biosEinrichten() {
			for (let n = 0; n < 256; n++) {
				const o = n * 4;
				this.ww(0, n * 4, o); this.ww(0, n * 4 + 2, BIOS_SEG);
				this.wb(BIOS_SEG, o, 0xf1); this.wb(BIOS_SEG, o + 1, n); this.wb(BIOS_SEG, o + 2, 0xcf);
			}
			// int 8 (Zeitgeber) als echter Code: Tick zählen, int 1Ch, EOI
			const code = [0x50, 0x1e, 0x31, 0xc0, 0x8e, 0xd8, 0xff, 0x06, 0x6c, 0x04, 0x75, 0x04, 0xff, 0x06, 0x6e, 0x04,
				0xcd, 0x1c, 0xb0, 0x20, 0xe6, 0x20, 0x1f, 0x58, 0xcf];
			const o8 = 0x500;
			code.forEach((b, i) => this.wb(BIOS_SEG, o8 + i, b));
			this.ww(0, 8 * 4, o8);
			// BIOS-Datenbereich
			this.ww(0x40, 0x10, 0x0021);        // Ausstattung: VGA/Farbe
			this.wb(0x40, 0x49, 3); this.ww(0x40, 0x4a, 80); this.ww(0x40, 0x4c, 4000);
			this.ww(0x40, 0x63, 0x3d4); this.wb(0x40, 0x84, 24); this.ww(0x40, 0x85, 16);
			this.ww(0x40, 0x13, 640);
		}

		laden(name, argumente) {
			const b = this.datei(name);
			if (!b) throw new Error(`${name} fehlt`);
			const w = (o) => b[o] | (b[o + 1] << 8);
			const kopf = w(8) * 16;
			const groesse = (w(4) - 1) * 512 + (w(2) || 512) - kopf;
			const psp = SEG_LADEN, start = psp + 0x10;
			this.m.set(b.subarray(kopf, kopf + groesse), start * 16);
			for (let i = 0; i < w(6); i++) {
				const off = w(w(0x18) + i * 4), seg = w(w(0x18) + i * 4 + 2);
				const a = (start + seg) * 16 + off;
				const v = (this.m[a] | (this.m[a + 1] << 8)) + start;
				this.m[a] = v & 0xff; this.m[a + 1] = (v >> 8) & 0xff;
			}
			// PSP: int 20h, Speicherende, Umgebung, Befehlszeile
			const ende = 0xa000;
			this.wb(psp, 0, 0xcd); this.wb(psp, 1, 0x20); this.ww(psp, 2, ende);
			const umg = 0x0f00;
			const umgText = 'PATH=C:\\\0\0\x01\0C:\\INTRO_E.OVL\0';
			for (let i = 0; i < umgText.length; i++) this.wb(umg, i, umgText.charCodeAt(i));
			this.ww(psp, 0x2c, umg);
			const arg = argumente ? ' ' + argumente : '';
			this.wb(psp, 0x80, arg.length);
			for (let i = 0; i < arg.length; i++) this.wb(psp, 0x81 + i, arg.charCodeAt(i));
			this.wb(psp, 0x81 + arg.length, 13);
			this.psp = psp;
			this.speicherFrei = start + Math.ceil(groesse / 16) + w(0x0a);
			this.s[0] = psp; this.s[3] = psp;
			this.s[1] = start + w(0x16); this.ip = w(0x14);
			this.s[2] = start + w(0x0e); this.r[4] = w(0x10);
		}

		datei(name) {
			const n = name.replace(/^.*[\\/:]/, '').toUpperCase();
			return this.dateien.get(n) || null;
		}

		// ---------- Register ----------
		get8(i) { return i < 4 ? this.r[i] & 0xff : this.r[i - 4] >> 8; }
		set8(i, v) { if (i < 4) this.r[i] = (this.r[i] & 0xff00) | (v & 0xff); else this.r[i - 4] = (this.r[i - 4] & 0xff) | ((v & 0xff) << 8); }
		flag(b) { return (this.fl >> b) & 1; }
		setFlag(b, an) { if (an) this.fl |= 1 << b; else this.fl &= ~(1 << b); }

		push(v) { this.r[4] = (this.r[4] - 2) & 0xffff; this.ww(this.s[2], this.r[4], v); }
		pop() { const v = this.rw(this.s[2], this.r[4]); this.r[4] = (this.r[4] + 2) & 0xffff; return v; }

		holB() { const v = this.rb(this.s[1], this.ip); this.ip = (this.ip + 1) & 0xffff; return v; }
		holW() { const v = this.rw(this.s[1], this.ip); this.ip = (this.ip + 2) & 0xffff; return v; }

		// ---------- ModR/M ----------
		modrm() {
			const b = this.holB();
			const mod = b >> 6, reg = (b >> 3) & 7, rm = b & 7;
			if (mod === 3) { this.ea = -1; this.eaReg = rm; return reg; }
			let off = 0, seg = 3;
			switch (rm) {
				case 0: off = this.r[3] + this.r[6]; break;
				case 1: off = this.r[3] + this.r[7]; break;
				case 2: off = this.r[5] + this.r[6]; seg = 2; break;
				case 3: off = this.r[5] + this.r[7]; seg = 2; break;
				case 4: off = this.r[6]; break;
				case 5: off = this.r[7]; break;
				case 6: if (mod === 0) off = this.holW(); else { off = this.r[5]; seg = 2; } break;
				case 7: off = this.r[3]; break;
			}
			if (mod === 1) { const d = this.holB(); off += d < 128 ? d : d - 256; }
			else if (mod === 2) off += this.holW();
			this.eaOff = off & 0xffff;
			this.eaSeg = this.segUeber >= 0 ? this.s[this.segUeber] : this.s[seg];
			this.ea = 1;
			return reg;
		}
		rmB() { return this.ea < 0 ? this.get8(this.eaReg) : this.rb(this.eaSeg, this.eaOff); }
		rmW() { return this.ea < 0 ? this.r[this.eaReg] : this.rw(this.eaSeg, this.eaOff); }
		setRmB(v) { if (this.ea < 0) this.set8(this.eaReg, v); else this.wb(this.eaSeg, this.eaOff, v); }
		setRmW(v) { if (this.ea < 0) this.r[this.eaReg] = v; else this.ww(this.eaSeg, this.eaOff, v); }
		datSeg() { return this.segUeber >= 0 ? this.s[this.segUeber] : this.s[3]; }

		// ---------- Flags ----------
		szp(v, w) {
			const mask = w ? 0xffff : 0xff;
			v &= mask;
			this.setFlag(6, v === 0);
			this.setFlag(7, v & (w ? 0x8000 : 0x80));
			let p = v & 0xff; p ^= p >> 4; p ^= p >> 2; p ^= p >> 1;
			this.setFlag(2, !(p & 1));
		}
		alu(op, a, b, w) {
			const mask = w ? 0xffff : 0xff, top = w ? 0x8000 : 0x80;
			let r;
			switch (op) {
				case 0: case 2: {                         // ADD, ADC
					const c = op === 2 ? this.flag(0) : 0;
					r = a + b + c;
					this.setFlag(0, r > mask);
					this.setFlag(11, ((a ^ r) & (b ^ r) & top) !== 0);
					this.setFlag(4, ((a ^ b ^ r) & 0x10) !== 0);
					break;
				}
				case 5: case 3: case 7: {                 // SUB, SBB, CMP
					const c = op === 3 ? this.flag(0) : 0;
					r = a - b - c;
					this.setFlag(0, r < 0);
					this.setFlag(11, ((a ^ b) & (a ^ r) & top) !== 0);
					this.setFlag(4, ((a ^ b ^ r) & 0x10) !== 0);
					break;
				}
				case 1: r = a | b; this.setFlag(0, 0); this.setFlag(11, 0); break;
				case 4: r = a & b; this.setFlag(0, 0); this.setFlag(11, 0); break;
				case 6: r = a ^ b; this.setFlag(0, 0); this.setFlag(11, 0); break;
			}
			r &= mask;
			this.szp(r, w);
			return r;
		}
		incdec(v, w, dec) {
			const mask = w ? 0xffff : 0xff, top = w ? 0x8000 : 0x80;
			const r = (dec ? v - 1 : v + 1) & mask;
			this.setFlag(11, dec ? v === top : r === top);
			this.setFlag(4, ((v ^ r) & 0x10) !== 0);
			this.szp(r, w);
			return r;
		}
		schieben(op, v, n, w) {
			const bits = w ? 16 : 8, mask = w ? 0xffff : 0xff, top = w ? 0x8000 : 0x80;
			n &= 0x1f;
			if (!n) return v;
			let cf = this.flag(0);
			const vorher = v;
			for (let i = 0; i < n; i++) {
				switch (op) {
					case 0: cf = (v & top) ? 1 : 0; v = ((v << 1) | cf) & mask; break;                 // ROL
					case 1: cf = v & 1; v = (v >> 1) | (cf ? top : 0); break;                             // ROR
					case 2: { const c = (v & top) ? 1 : 0; v = ((v << 1) | cf) & mask; cf = c; break; }   // RCL
					case 3: { const c = v & 1; v = (v >> 1) | (cf ? top : 0); cf = c; break; }           // RCR
					case 4: case 6: cf = (v & top) ? 1 : 0; v = (v << 1) & mask; break;                   // SHL
					case 5: cf = v & 1; v >>= 1; break;                                                   // SHR
					case 7: cf = v & 1; v = (v >> 1) | (v & top); break;                                  // SAR
				}
			}
			this.setFlag(0, cf);
			if (op >= 4) this.szp(v, w);
			if (op === 0 || op === 2 || op === 4 || op === 6) this.setFlag(11, ((v & top) ? 1 : 0) ^ cf);
			else if (op === 1 || op === 3) this.setFlag(11, ((v ^ (v << 1)) & top) !== 0);
			else if (op === 5) this.setFlag(11, (vorher & top) !== 0);
			else this.setFlag(11, 0);
			return v;
		}
		bed(c) {
			const f = (b) => this.flag(b);
			switch (c) {
				case 0: return f(11); case 1: return !f(11);
				case 2: return f(0); case 3: return !f(0);
				case 4: return f(6); case 5: return !f(6);
				case 6: return f(0) || f(6); case 7: return !f(0) && !f(6);
				case 8: return f(7); case 9: return !f(7);
				case 10: return f(2); case 11: return !f(2);
				case 12: return f(7) !== f(11); case 13: return f(7) === f(11);
				case 14: return f(6) || f(7) !== f(11); case 15: return !f(6) && f(7) === f(11);
			}
		}

		// ---------- Interrupts ----------
		interrupt(n) {
			this.push(this.fl); this.push(this.s[1]); this.push(this.ip);
			this.setFlag(9, 0); this.setFlag(8, 0);
			this.ip = this.rw(0, n * 4); this.s[1] = this.rw(0, n * 4 + 2);
		}

		// Zeitgeber: nächster Tick in virtuellen Befehlen
		pitTakt() { return CPU_HZ * this.pitTeiler / PIT_HZ; }
		// aktueller Zählerstand von Kanal 0 (Modus 3 zählt in Zweierschritten, zweimal je Periode)
		pitZaehler() {
			const takte = Math.floor((this.befehle - this.pitStart) * PIT_HZ / CPU_HZ);
			const t = this.pitTeiler;
			if ((this.pitModus & 3) === 3) return (t - ((takte * 2) % t)) & 0xfffe;
			return (t - (takte % t)) & 0xffff;
		}

		// ---------- Ausführung ----------
		// läuft bis zur virtuellen Zeit bis (Befehle)
		laufen(bis) {
			if (!this.pitNaechst) this.pitNaechst = this.befehle + this.pitTakt();
			while (this.befehle < bis && !this.beendet) {
				if (this.befehle >= this.pitNaechst) {
					this.pitNaechst += this.pitTakt();
					this.irqWartet = true;
				}
				if (this.irqWartet && !this.irqAktiv && this.flag(9) && !(this.picMaske & 1)) {
					this.irqWartet = false; this.irqAktiv = true; this.angehalten = false;
					this.interrupt(8);
				}
				if (this.angehalten) { this.befehle = Math.min(bis, this.pitNaechst); continue; }
				const ende = Math.min(bis, this.pitNaechst);
				this.grenze = ende;
				try {
					while (this.befehle < ende && !this.beendet && !this.angehalten) {
						this.schritt(); this.befehle++;
						// wartender Zeitgeber-Interrupt: zustellen, sobald IF wieder gesetzt ist (etwa nach IRET)
						if (this.irqWartet && !this.irqAktiv && (this.fl & 0x200) && !(this.picMaske & 1)) break;
					}
				} catch (e) {
					this.fehler = e; this.beendet = true;
					this.log(`Fehler bei ${this.s[1].toString(16)}:${this.ip.toString(16)}: ${e.message}`);
				}
			}
		}

		schritt() {
			this.segUeber = -1;
			let rep = 0;
			const start = this.ip;
			let op = this.holB();
			for (;;) {
				if (op === 0x26 || op === 0x2e || op === 0x36 || op === 0x3e) { this.segUeber = (op >> 3) & 3; op = this.holB(); }
				else if (op === 0xf2 || op === 0xf3) { rep = op; op = this.holB(); }
				else if (op === 0xf0) op = this.holB();
				else break;
			}
			const r = this.r, s = this.s;
			if (op < 0x40 && (op & 7) < 6) {
				const alu = op >> 3, art = op & 7;
				let a, b, w = art & 1;
				switch (art) {
					case 0: case 1: { const reg = this.modrm(); a = w ? this.rmW() : this.rmB(); b = w ? r[reg] : this.get8(reg);
						const v = this.alu(alu, a, b, w); if (alu !== 7) { if (w) this.setRmW(v); else this.setRmB(v); } return; }
					case 2: case 3: { const reg = this.modrm(); a = w ? r[reg] : this.get8(reg); b = w ? this.rmW() : this.rmB();
						const v = this.alu(alu, a, b, w); if (alu !== 7) { if (w) r[reg] = v; else this.set8(reg, v); } return; }
					case 4: { const v = this.alu(alu, r[0] & 0xff, this.holB(), 0); if (alu !== 7) this.set8(0, v); return; }
					case 5: { const v = this.alu(alu, r[0], this.holW(), 1); if (alu !== 7) r[0] = v; return; }
				}
			}
			switch (op) {
				case 0x06: this.push(s[0]); return; case 0x07: s[0] = this.pop(); return;
				case 0x0e: this.push(s[1]); return;
				case 0x16: this.push(s[2]); return; case 0x17: s[2] = this.pop(); return;
				case 0x1e: this.push(s[3]); return; case 0x1f: s[3] = this.pop(); return;
				case 0x27: case 0x2f: {                 // DAA, DAS
					let al = r[0] & 0xff; const cf = this.flag(0), af = this.flag(4);
					if ((al & 0xf) > 9 || af) { al = op === 0x27 ? al + 6 : al - 6; this.setFlag(4, 1); } else this.setFlag(4, 0);
					if ((r[0] & 0xff) > 0x99 || cf) { al = op === 0x27 ? al + 0x60 : al - 0x60; this.setFlag(0, 1); } else this.setFlag(0, 0);
					this.set8(0, al); this.szp(al & 0xff, 0); return;
				}
				case 0x37: case 0x3f: {                 // AAA, AAS
					if ((r[0] & 0xf) > 9 || this.flag(4)) {
						const al = op === 0x37 ? (r[0] & 0xff) + 6 : (r[0] & 0xff) - 6;
						const ah = ((r[0] >> 8) + (op === 0x37 ? 1 : -1)) & 0xff;
						r[0] = (ah << 8) | (al & 0xf); this.setFlag(4, 1); this.setFlag(0, 1);
					} else { r[0] &= 0xff0f; this.setFlag(4, 0); this.setFlag(0, 0); }
					return;
				}
			}
			if (op >= 0x40 && op < 0x50) { const i = op & 7; r[i] = this.incdec(r[i], 1, op >= 0x48); return; }
			if (op >= 0x50 && op < 0x58) { this.push(op === 0x54 ? r[4] : r[op & 7]); return; }
			if (op >= 0x58 && op < 0x60) { r[op & 7] = this.pop(); return; }
			if (op >= 0x70 && op < 0x80) {
				const d = this.holB();
				if (this.bed(op & 15)) { if (d >= 128) this.warteschleife(start); this.ip = (this.ip + (d < 128 ? d : d - 256)) & 0xffff; }
				return;
			}
			if (op >= 0x91 && op < 0x98) { const i = op & 7, t = r[0]; r[0] = r[i]; r[i] = t; return; }
			if (op >= 0xb0 && op < 0xb8) { this.set8(op & 7, this.holB()); return; }
			if (op >= 0xb8 && op < 0xc0) { r[op & 7] = this.holW(); return; }
			switch (op) {
				case 0x60: { const sp = r[4]; for (let i = 0; i < 8; i++) this.push(i === 4 ? sp : r[i]); return; }
				case 0x61: for (let i = 7; i >= 0; i--) { const v = this.pop(); if (i !== 4) r[i] = v; } return;
				case 0x62: this.modrm(); return;            // BOUND: keine Prüfung
				case 0x68: this.push(this.holW()); return;
				case 0x6a: { const v = this.holB(); this.push(v < 128 ? v : v | 0xff00); return; }
				case 0x69: case 0x6b: {
					const reg = this.modrm(); const a = this.vz(this.rmW(), 1);
					let b = op === 0x69 ? this.holW() : this.holB(); b = op === 0x69 ? this.vz(b, 1) : this.vz(b, 0);
					const p = a * b; r[reg] = p & 0xffff;
					const ueber = p < -32768 || p > 32767; this.setFlag(0, ueber); this.setFlag(11, ueber); return;
				}
				case 0x6c: case 0x6d: case 0x6e: case 0x6f: this.stringOp(op, rep); return;
				case 0x80: case 0x81: case 0x82: case 0x83: {
					const reg = this.modrm(), w = op & 1;
					const a = w ? this.rmW() : this.rmB();
					let b = op === 0x81 ? this.holW() : this.holB();
					if (op === 0x83 && b & 0x80) b |= 0xff00;
					const v = this.alu(reg, a, b, w);
					if (reg !== 7) { if (w) this.setRmW(v); else this.setRmB(v); }
					return;
				}
				case 0x84: { const reg = this.modrm(); this.alu(4, this.rmB(), this.get8(reg), 0); return; }
				case 0x85: { const reg = this.modrm(); this.alu(4, this.rmW(), r[reg], 1); return; }
				case 0x86: { const reg = this.modrm(); const t = this.rmB(); this.setRmB(this.get8(reg)); this.set8(reg, t); return; }
				case 0x87: { const reg = this.modrm(); const t = this.rmW(); this.setRmW(r[reg]); r[reg] = t; return; }
				case 0x88: { const reg = this.modrm(); this.setRmB(this.get8(reg)); return; }
				case 0x89: { const reg = this.modrm(); this.setRmW(r[reg]); return; }
				case 0x8a: { const reg = this.modrm(); this.set8(reg, this.rmB()); return; }
				case 0x8b: { const reg = this.modrm(); r[reg] = this.rmW(); return; }
				case 0x8c: { const reg = this.modrm(); this.setRmW(s[reg & 3]); return; }
				case 0x8d: { const reg = this.modrm(); r[reg] = this.eaOff; return; }
				case 0x8e: { const reg = this.modrm(); s[reg & 3] = this.rmW(); return; }
				case 0x8f: { this.modrm(); this.setRmW(this.pop()); return; }
				case 0x90: return;
				case 0x98: r[0] = (r[0] & 0x80) ? r[0] | 0xff00 : r[0] & 0xff; return;
				case 0x99: r[2] = (r[0] & 0x8000) ? 0xffff : 0; return;
				case 0x9a: { const o = this.holW(), sg = this.holW(); this.push(s[1]); this.push(this.ip); s[1] = sg; this.ip = o; return; }
				case 0x9b: return;
				case 0x9c: this.push(this.fl | 0xf002); return;
				case 0x9d: this.fl = (this.pop() & 0x0fd5) | 0x0002; return;
				case 0x9e: this.fl = (this.fl & 0xff00) | ((r[0] >> 8) & 0xd5) | 2; return;
				case 0x9f: this.set8(4, this.fl & 0xff); return;
				case 0xa0: this.set8(0, this.rb(this.datSeg(), this.holW())); return;
				case 0xa1: r[0] = this.rw(this.datSeg(), this.holW()); return;
				case 0xa2: this.wb(this.datSeg(), this.holW(), r[0] & 0xff); return;
				case 0xa3: this.ww(this.datSeg(), this.holW(), r[0]); return;
				case 0xa4: case 0xa5: case 0xa6: case 0xa7: case 0xaa: case 0xab: case 0xac: case 0xad: case 0xae: case 0xaf:
					this.stringOp(op, rep); return;
				case 0xa8: this.alu(4, r[0] & 0xff, this.holB(), 0); return;
				case 0xa9: this.alu(4, r[0], this.holW(), 1); return;
				case 0xc0: case 0xc1: case 0xd0: case 0xd1: case 0xd2: case 0xd3: {
					const reg = this.modrm(), w = op & 1;
					const n = op < 0xc2 ? this.holB() : op < 0xd2 ? 1 : r[1] & 0xff;
					const v = this.schieben(reg, w ? this.rmW() : this.rmB(), n, w);
					if (w) this.setRmW(v); else this.setRmB(v);
					return;
				}
				case 0xc2: { const n = this.holW(); this.ip = this.pop(); r[4] = (r[4] + n) & 0xffff; return; }
				case 0xc3: this.ip = this.pop(); return;
				case 0xc4: case 0xc5: { const reg = this.modrm(); r[reg] = this.rw(this.eaSeg, this.eaOff); s[op === 0xc4 ? 0 : 3] = this.rw(this.eaSeg, this.eaOff + 2); return; }
				case 0xc6: { this.modrm(); this.setRmB(this.holB()); return; }
				case 0xc7: { this.modrm(); this.setRmW(this.holW()); return; }
				case 0xc8: {
					const groesse = this.holW(), tiefe = this.holB() & 31;
					this.push(r[5]); const rahmen = r[4];
					for (let i = 1; i < tiefe; i++) { r[5] = (r[5] - 2) & 0xffff; this.push(this.rw(s[2], r[5])); }
					if (tiefe) this.push(rahmen);
					r[5] = rahmen; r[4] = (r[4] - groesse) & 0xffff; return;
				}
				case 0xc9: r[4] = r[5]; r[5] = this.pop(); return;
				case 0xca: { const n = this.holW(); this.ip = this.pop(); s[1] = this.pop(); r[4] = (r[4] + n) & 0xffff; return; }
				case 0xcb: this.ip = this.pop(); s[1] = this.pop(); return;
				case 0xcc: this.interrupt(3); return;
				case 0xcd: this.interrupt(this.holB()); return;
				case 0xce: if (this.flag(11)) this.interrupt(4); return;
				case 0xcf: this.ip = this.pop(); s[1] = this.pop(); this.fl = (this.pop() & 0x0fd5) | 2; return;
				case 0xd4: { const n = this.holB() || 10; const al = r[0] & 0xff; r[0] = ((Math.floor(al / n) & 0xff) << 8) | (al % n); this.szp(r[0] & 0xff, 0); return; }
				case 0xd5: { const n = this.holB(); const al = ((r[0] & 0xff) + (r[0] >> 8) * n) & 0xff; r[0] = al; this.szp(al, 0); return; }
				case 0xd6: this.set8(0, this.flag(0) ? 0xff : 0); return;
				case 0xd7: this.set8(0, this.rb(this.datSeg(), (r[3] + (r[0] & 0xff)) & 0xffff)); return;
				case 0xe0: case 0xe1: case 0xe2: {
					const d = this.holB(); r[1] = (r[1] - 1) & 0xffff;
					const z = this.flag(6);
					if (r[1] !== 0 && (op === 0xe2 || (op === 0xe1 ? z : !z))) this.ip = (this.ip + (d < 128 ? d : d - 256)) & 0xffff;
					return;
				}
				case 0xe3: { const d = this.holB(); if (r[1] === 0) this.ip = (this.ip + (d < 128 ? d : d - 256)) & 0xffff; return; }
				case 0xe4: this.set8(0, this.portLesen(this.holB())); return;
				case 0xe5: r[0] = this.portLesen(this.holB(), 1); return;
				case 0xe6: this.portSchreiben(this.holB(), r[0] & 0xff); return;
				case 0xe7: { const p = this.holB(); this.portSchreiben(p, r[0] & 0xff); this.portSchreiben(p + 1, r[0] >> 8); return; }
				case 0xe8: { const d = this.holW(); this.push(this.ip); this.ip = (this.ip + d) & 0xffff; return; }
				case 0xe9: { const d = this.holW(); this.ip = (this.ip + d) & 0xffff; return; }
				case 0xea: { const o = this.holW(), sg = this.holW(); this.ip = o; s[1] = sg; return; }
				case 0xeb: { const d = this.holB(); if (d >= 128) this.warteschleife(start); this.ip = (this.ip + (d < 128 ? d : d - 256)) & 0xffff; return; }
				case 0xec: this.set8(0, this.portLesen(r[2])); return;
				case 0xed: r[0] = this.portLesen(r[2], 1); return;
				case 0xee: this.portSchreiben(r[2], r[0] & 0xff); return;
				case 0xef: this.portSchreiben(r[2], r[0] & 0xff); this.portSchreiben(r[2] + 1, r[0] >> 8); return;
				case 0xf1: { const n = this.holB(); this.dienst(n); return; }   // Stummel: JS-Dienst
				case 0xf4: this.angehalten = true; return;
				case 0xf5: this.setFlag(0, !this.flag(0)); return;
				case 0xf6: case 0xf7: this.gruppe3(op & 1); return;
				case 0xf8: this.setFlag(0, 0); return; case 0xf9: this.setFlag(0, 1); return;
				case 0xfa: this.setFlag(9, 0); return; case 0xfb: this.setFlag(9, 1); return;
				case 0xfc: this.setFlag(10, 0); return; case 0xfd: this.setFlag(10, 1); return;
				case 0xfe: {
					const reg = this.modrm();
					if (reg > 1) throw new Error('FE /' + reg);
					this.setRmB(this.incdec(this.rmB(), 0, reg === 1)); return;
				}
				case 0xff: {
					const reg = this.modrm();
					switch (reg) {
						case 0: case 1: this.setRmW(this.incdec(this.rmW(), 1, reg === 1)); return;
						case 2: { const z = this.rmW(); this.push(this.ip); this.ip = z; return; }
						case 3: { const o = this.rw(this.eaSeg, this.eaOff), sg = this.rw(this.eaSeg, this.eaOff + 2); this.push(s[1]); this.push(this.ip); this.ip = o; s[1] = sg; return; }
						case 4: this.ip = this.rmW(); return;
						case 5: { this.ip = this.rw(this.eaSeg, this.eaOff); s[1] = this.rw(this.eaSeg, this.eaOff + 2); return; }
						case 6: this.push(this.rmW()); return;
					}
					throw new Error('FF /' + reg);
				}
			}
			if (op >= 0xd8 && op <= 0xdf) { this.modrm(); return; }   // Koprozessor: ignorieren
			this.ip = start;
			throw new Error(`Befehl ${op.toString(16)} nicht unterstützt`);
		}

		// Rückwärtssprung: kam dieselbe Schleife eben schon hier vorbei, ohne zu schreiben (Speicher, Ports) und mit
		// gleichen Registern, wiederholt sie sich unverändert bis zum nächsten Interrupt: so lange vorspulen.
		warteschleife(ip) {
			const sl = this.schleife, r = this.r, s = this.s;
			const gleich = sl.ip === ip && sl.cs === s[1] && this.befehle - sl.befehle < 32 && sl.schreibe === this.schreibe &&
				r[0] === sl.regs[0] && r[1] === sl.regs[1] && r[2] === sl.regs[2] && r[3] === sl.regs[3] && r[4] === sl.regs[4] &&
				r[5] === sl.regs[5] && r[6] === sl.regs[6] && r[7] === sl.regs[7] && s[0] === sl.regs[8] && s[2] === sl.regs[10] && s[3] === sl.regs[11];
			if (gleich && (this.fl & 0x200)) this.vorspulen(this.pitNaechst);
			sl.ip = ip; sl.cs = s[1]; sl.befehle = this.befehle; sl.schreibe = this.schreibe;
			for (let i = 0; i < 8; i++) sl.regs[i] = r[i];
			sl.regs[8] = s[0]; sl.regs[10] = s[2]; sl.regs[11] = s[3];
		}

		// virtuelle Zeit ohne Befehle vergehen lassen (nicht über die Laufgrenze und den nächsten Tick hinaus)
		vorspulen(ziel) {
			const bis = Math.min(ziel, this.grenze ?? ziel, this.pitNaechst) - 1;
			if (bis > this.befehle) { this.gespult = (this.gespult || 0) + bis - this.befehle; this.befehle = bis; }
		}

		vz(v, w) { return w ? (v & 0x8000 ? v - 0x10000 : v) : (v & 0x80 ? v - 0x100 : v); }

		gruppe3(w) {
			const r = this.r, reg = this.modrm();
			const v = w ? this.rmW() : this.rmB();
			switch (reg) {
				case 0: case 1: this.alu(4, v, w ? this.holW() : this.holB(), w); return;
				case 2: if (w) this.setRmW(~v & 0xffff); else this.setRmB(~v & 0xff); return;
				case 3: { const e = this.alu(5, 0, v, w); this.setFlag(0, v !== 0); if (w) this.setRmW(e); else this.setRmB(e); return; }
				case 4: {
					if (w) { const p = r[0] * v; r[0] = p & 0xffff; r[2] = (p >>> 16) & 0xffff; const h = r[2] !== 0; this.setFlag(0, h); this.setFlag(11, h); }
					else { const p = (r[0] & 0xff) * v; r[0] = p & 0xffff; const h = (p >> 8) !== 0; this.setFlag(0, h); this.setFlag(11, h); }
					return;
				}
				case 5: {
					if (w) { const p = this.vz(r[0], 1) * this.vz(v, 1); r[0] = p & 0xffff; r[2] = (p >> 16) & 0xffff; const h = p < -32768 || p > 32767; this.setFlag(0, h); this.setFlag(11, h); }
					else { const p = this.vz(r[0] & 0xff, 0) * this.vz(v, 0); r[0] = p & 0xffff; const h = p < -128 || p > 127; this.setFlag(0, h); this.setFlag(11, h); }
					return;
				}
				case 6: {
					if (!v) { this.interrupt(0); return; }
					if (w) { const n = ((r[2] << 16) >>> 0) + r[0]; const q = Math.floor(n / v); if (q > 0xffff) { this.interrupt(0); return; } r[0] = q; r[2] = n % v; }
					else { const n = r[0]; const q = Math.floor(n / v); if (q > 0xff) { this.interrupt(0); return; } r[0] = ((n % v) << 8) | q; }
					return;
				}
				case 7: {
					if (!v) { this.interrupt(0); return; }
					if (w) { const n = (r[2] << 16) | r[0]; const d = this.vz(v, 1); const q = Math.trunc(n / d); if (q > 32767 || q < -32768) { this.interrupt(0); return; } r[0] = q & 0xffff; r[2] = (n - q * d) & 0xffff; }
					else { const n = this.vz(r[0], 1); const d = this.vz(v, 0); const q = Math.trunc(n / d); if (q > 127 || q < -128) { this.interrupt(0); return; } r[0] = (((n - q * d) & 0xff) << 8) | (q & 0xff); }
					return;
				}
			}
		}

		stringOp(op, rep) {
			const r = this.r, s = this.s;
			const w = op & 1;
			const d = this.flag(10) ? -(w + 1) : (w + 1);
			const quelle = this.datSeg();
			const einmal = () => {
				switch (op) {
					case 0xa4: this.wb(s[0], r[7], this.rb(quelle, r[6])); r[6] += d; r[7] += d; break;
					case 0xa5: this.ww(s[0], r[7], this.rw(quelle, r[6])); r[6] += d; r[7] += d; break;
					case 0xa6: this.alu(7, this.rb(quelle, r[6]), this.rb(s[0], r[7]), 0); r[6] += d; r[7] += d; break;
					case 0xa7: this.alu(7, this.rw(quelle, r[6]), this.rw(s[0], r[7]), 1); r[6] += d; r[7] += d; break;
					case 0xaa: this.wb(s[0], r[7], r[0] & 0xff); r[7] += d; break;
					case 0xab: this.ww(s[0], r[7], r[0]); r[7] += d; break;
					case 0xac: this.set8(0, this.rb(quelle, r[6])); r[6] += d; break;
					case 0xad: r[0] = this.rw(quelle, r[6]); r[6] += d; break;
					case 0xae: this.alu(7, r[0] & 0xff, this.rb(s[0], r[7]), 0); r[7] += d; break;
					case 0xaf: this.alu(7, r[0], this.rw(s[0], r[7]), 1); r[7] += d; break;
					case 0x6c: this.wb(s[0], r[7], this.portLesen(r[2])); r[7] += d; break;
					case 0x6d: this.ww(s[0], r[7], this.portLesen(r[2], 1)); r[7] += d; break;
					case 0x6e: this.portSchreiben(r[2], this.rb(quelle, r[6])); r[6] += d; break;
					case 0x6f: { const v = this.rw(quelle, r[6]); this.portSchreiben(r[2], v & 0xff); this.portSchreiben(r[2] + 1, v >> 8); r[6] += d; break; }
				}
			};
			if (!rep) { einmal(); return; }
			const vergleich = op === 0xa6 || op === 0xa7 || op === 0xae || op === 0xaf;
			while (r[1]) {
				einmal(); r[1]--; this.befehle++;
				if (vergleich && (rep === 0xf3 ? !this.flag(6) : this.flag(6))) break;
			}
		}

		// ---------- Ports ----------
		portLesen(p, w) {
			p &= 0xffff;
			this.schreibe++;               // Ports können sich ohne Interrupt ändern: keine Warteschleife im Sinne von warteschleife()
			let v = 0xff;
			switch (p) {
				case 0x3da: {                       // Statusregister: Bit 3 Strahlrücklauf, Bit 0 Anzeige aus
					// 400 Zeilen je Bild: Bit 0 in den letzten 20 % jeder Zeile (horizontaler Rücklauf)
					const bild = CPU_HZ / VSYNC_HZ, zeile = bild / 400, phase = this.befehle % bild;
					const ruecklauf = phase > bild * 0.95, inZeile = phase % zeile;
					v = ruecklauf ? 0x09 : inZeile > zeile * 0.8 ? 0x01 : 0;
					// enge Warteschleife, Wert unverändert seit dem letzten Lesen: bis zum nächsten Wechsel vorspulen
					// (gleiches Verhalten, weniger Rechnen)
					if (this.befehle - this.letzte3da < 64 && v === this.letzterStatus) {
						const basis = this.befehle - phase;
						let ziel;
						if (ruecklauf) ziel = basis + bild;
						else if (v & 1) ziel = Math.min(basis + (Math.floor(phase / zeile) + 1) * zeile, basis + bild * 0.95);
						else ziel = Math.min(basis + Math.floor(phase / zeile) * zeile + zeile * 0.8, basis + bild * 0.95);
						this.vorspulen(ziel + 1);
					}
					this.letzte3da = this.befehle; this.letzterStatus = v;
					break;
				}
				case 0x3c9: v = this.palette[this.dacLese * 3 + this.dacTeil] & 0x3f; if (++this.dacTeil === 3) { this.dacTeil = 0; this.dacLese = (this.dacLese + 1) & 0xff; } break;
				case 0x40: {                        // Zähler 0: zuerst Low-, dann High-Byte (oder gespeicherter Latch)
					if (this.pitLatch === null) this.pitLatch = this.pitZaehler();
					v = this.pitLeseHi ? this.pitLatch >> 8 : this.pitLatch & 0xff;
					if (this.pitLeseHi) this.pitLatch = null;
					this.pitLeseHi = !this.pitLeseHi;
					break;
				}
				case 0x21: v = this.picMaske; break;
				case 0x60: v = this.letzteTaste || 0; break;
				case 0x61: v = 0; break;
			}
			return w ? v | (this.portLesen(p + 1) << 8) : v;
		}
		portSchreiben(p, v) {
			p &= 0xffff;
			this.schreibe++;
			switch (p) {
				case 0x3c8: this.dacSchreib = v; this.dacTeil = 0; break;
				case 0x3c7: this.dacLese = v; this.dacTeil = 0; break;
				case 0x3c9: this.palette[this.dacSchreib * 3 + this.dacTeil] = v & 0x3f; if (++this.dacTeil === 3) { this.dacTeil = 0; this.dacSchreib = (this.dacSchreib + 1) & 0xff; } break;
				case 0x43:
					if ((v >> 6) !== 0) { this.pitKanal = v >> 6; break; }
					this.pitKanal = 0;
					if (((v >> 4) & 3) === 0) { this.pitLatch = this.pitZaehler(); this.pitLeseHi = false; break; }   // Latch
					this.pitZugriff = (v >> 4) & 3; this.pitModus = (v >> 1) & 7; this.pitLo = null; this.pitLatch = null; this.pitLeseHi = false;
					break;
				case 0x40:
					if (this.pitKanal !== 0) break;
					if (this.pitZugriff === 3) {
						if (this.pitLo === null) { this.pitLo = v; break; }
						v = this.pitLo | (v << 8); this.pitLo = null;
					}
					this.pitTeiler = v || 65536;
					this.pitStart = this.befehle;
					this.pitNaechst = this.befehle + this.pitTakt();
					break;
				case 0x20: if (v === 0x20) this.irqAktiv = false; break;
				case 0x21: this.picMaske = v; break;
			}
		}

		// ---------- Dienste (BIOS, DOS, Musik) ----------
		dienst(n) {
			const r = this.r;
			const ah = r[0] >> 8, al = r[0] & 0xff;
			const cf = (an) => {         // Carry im gesicherten Flag-Wort setzen (IRET stellt es her)
				const a = this.lin(this.s[2], r[4] + 4);
				const f = this.m[a] | (this.m[a + 1] << 8);
				const nf = an ? f | 1 : f & ~1;
				this.m[a] = nf & 0xff; this.m[a + 1] = nf >> 8;
			};
			const zf = (an) => {
				const a = this.lin(this.s[2], r[4] + 4);
				const f = this.m[a] | (this.m[a + 1] << 8);
				const nf = an ? f | 0x40 : f & ~0x40;
				this.m[a] = nf & 0xff; this.m[a + 1] = nf >> 8;
			};
			switch (n) {
				case 0x10: return this.video(ah, al);
				case 0x16:
					if (ah === 0 || ah === 0x10) {
						if (!this.tasten.length) { this.ip -= 2; this.angehalten = true; return; }   // wartet auf Taste
						r[0] = this.tasten.shift(); return;
					}
					if (ah === 1 || ah === 0x11) {
						if (this.tasten.length) { r[0] = this.tasten[0]; zf(0); return; }
						zf(1);
						// in einer Warteschleife abgefragt: bis zum nächsten Zeitgeber-Tick vorspulen
						if (this.befehle - this.letzteTastenfrage < 40) this.vorspulen(this.pitNaechst);
						this.letzteTastenfrage = this.befehle;
						return;
					}
					if (ah === 2) { this.set8(0, 0); return; }
					return;
				case 0x1a: if (ah === 0) { r[2] = this.rw(0x40, 0x6c); r[1] = this.rw(0x40, 0x6e); this.set8(0, 0); } return;
				case 0x21: return this.dos(ah, al, cf);
				case 0x20: this.ende(0); return;
				case 0x80: return this.musik(r[0], r[3]);
				case 0xfe:                               // Marke aus durchlaufMarke(): Anfang der Intro-Schleife
					if (++this.durchlaeufe > 1) { this.ende(0); return; }
					this.push((this.ip + 1) & 0xffff); this.ip = 0x3459; return;
				case 0x1c: case 0x1b: case 0x23: case 0x24: return;
				case 0x11: r[0] = this.rw(0x40, 0x10); return;
				case 0x12: r[0] = 640; return;
				case 0x15: cf(1); this.set8(4, 0x86); return;
				default:
					if (n >= 0x08 && n <= 0x0f) { this.portSchreiben(0x20, 0x20); return; }   // übrige IRQs
					this.log(`int ${n.toString(16)} ax=${r[0].toString(16)} ignoriert`);
			}
		}

		video(ah, al) {
			const r = this.r;
			switch (ah) {
				case 0x00:
					this.wb(0x40, 0x49, al & 0x7f);
					if ((al & 0x7f) === 0x13) { if (!(al & 0x80)) this.m.fill(0, 0xa0000, 0xb0000); this.ww(0x40, 0x4a, 40); }
					else this.ww(0x40, 0x4a, 80);
					return;
				case 0x0f: r[0] = (this.rb(0x40, 0x4a) << 8) | this.rb(0x40, 0x49); this.set8(7, 0); return;
				case 0x10:
					if (al === 0x10) { const i = r[3] & 0xff; this.palette[i * 3] = r[2] >> 8 & 0x3f; this.palette[i * 3 + 1] = r[1] >> 8 & 0x3f; this.palette[i * 3 + 2] = r[1] & 0x3f; }
					else if (al === 0x12) { for (let i = 0; i < r[1] * 3; i++) this.palette[(r[3] * 3 + i) % 768] = this.rb(this.s[0], r[2] + i) & 0x3f; }
					else if (al === 0x15) { const i = r[3] & 0xff; r[2] = this.palette[i * 3] << 8; r[1] = (this.palette[i * 3 + 1] << 8) | this.palette[i * 3 + 2]; }
					else if (al === 0x17) { for (let i = 0; i < r[1] * 3; i++) this.wb(this.s[0], r[2] + i, this.palette[(r[3] * 3 + i) % 768]); }
					return;
				case 0x12: if ((r[3] & 0xff) === 0x10) { r[3] = 0x0003; r[1] = 0x0009; } return;
				case 0x1a: if (al === 0) { r[0] = (r[0] & 0xff00) | 0x1a; r[3] = 0x0008; } return;
				case 0x4f: r[0] = 0x0100; return;          // kein VESA
				case 0x0e: case 0x09: this.text = (this.text || '') + String.fromCharCode(al); if (al === 10 || this.text.length > 70) { this.log('Text: ' + this.text); this.text = ''; } return;
				case 0x02: case 0x03: case 0x01: case 0x05: case 0x06: case 0x07: case 0x08: case 0x0b: case 0x11: return;
			}
			this.log(`int 10 ah=${ah.toString(16)} ignoriert`);
		}

		dos(ah, al, cf) {
			const r = this.r, s = this.s;
			const text = (seg, off) => { let t = ''; for (let i = 0; i < 128; i++) { const c = this.rb(seg, off + i); if (!c) break; t += String.fromCharCode(c); } return t; };
			cf(0);
			switch (ah) {
				case 0x30: r[0] = 0x0005; r[3] = 0; r[1] = 0; return;   // DOS 5.0
				case 0x25: this.ww(0, al * 4, r[2]); this.ww(0, al * 4 + 2, s[3]); return;
				case 0x35: r[3] = this.rw(0, al * 4); s[0] = this.rw(0, al * 4 + 2); return;
				case 0x4a: {                                         // Speicherblock ändern
					const neu = s[0] + r[3];
					if (neu > 0x9fff) { r[3] = 0x9fff - s[0]; r[0] = 8; cf(1); return; }
					if (s[0] === this.psp) this.speicherFrei = neu;
					return;
				}
				case 0x48: {
					const frei = 0x9fff - this.speicherFrei;
					if (r[3] > frei) { r[3] = frei; r[0] = 8; cf(1); return; }
					r[0] = this.speicherFrei; this.speicherFrei += r[3]; return;
				}
				case 0x49: return;
				case 0x3d: {
					const name = text(s[3], r[2]);
					const d = this.datei(name);
					if (!d) { r[0] = 2; cf(1); this.log('Datei fehlt: ' + name); return; }
					const h = this.naechstesHandle++;
					this.handles.set(h, { d, pos: 0 });
					r[0] = h; return;
				}
				case 0x3c: r[0] = 5; cf(1); return;                  // Anlegen: nicht erlaubt
				case 0x3e: this.handles.delete(r[3]); return;
				case 0x3f: {
					const f = this.handles.get(r[3]);
					if (!f) { if (r[3] === 0) { r[0] = 0; return; } r[0] = 6; cf(1); return; }
					const n = Math.min(r[1], f.d.length - f.pos);
					for (let i = 0; i < n; i++) this.wb(s[3], r[2] + i, f.d[f.pos + i]);
					f.pos += n; r[0] = n; return;
				}
				case 0x40: {
					if (r[3] === 1 || r[3] === 2) { let t = ''; for (let i = 0; i < r[1]; i++) t += String.fromCharCode(this.rb(s[3], r[2] + i)); this.log('Ausgabe: ' + t); }
					r[0] = r[1]; return;
				}
				case 0x42: {
					const f = this.handles.get(r[3]);
					if (!f) { r[0] = 6; cf(1); return; }
					const off = (r[1] << 16 | r[2]) >>> 0;
					f.pos = al === 0 ? off : al === 1 ? f.pos + (off | 0) : f.d.length + (off | 0);
					r[0] = f.pos & 0xffff; r[2] = f.pos >>> 16; return;
				}
				case 0x44:
					if (al === 0) { r[2] = r[3] <= 2 ? 0x80d3 : 0x0002; return; }
					return;
				case 0x4c: this.ende(al); return;
				case 0x19: this.set8(0, 2); return;
				case 0x0e: this.set8(0, 26); return;
				case 0x1a: this.dta = [s[3], r[2]]; return;
				case 0x2f: s[0] = this.dta ? this.dta[0] : this.psp; r[3] = this.dta ? this.dta[1] : 0x80; return;
				case 0x2a: r[1] = 1992; r[2] = 0x0301; this.set8(0, 0); return;
				case 0x2c: { const t = Math.floor(this.befehle / CPU_HZ * 100); r[1] = 0; r[2] = (Math.floor(t / 100) % 60) << 8 | (t % 100); return; }
				case 0x47: this.wb(s[3], r[6], 0); return;
				case 0x0b: this.set8(0, this.tasten.length ? 0xff : 0); return;
				case 0x4e: case 0x4f: r[0] = 18; cf(1); return;
				case 0x29: return;
				case 0x34: s[0] = 0x50; r[3] = 0x10; return;        // InDOS-Flag: ein Nullbyte im BIOS-Bereich
			}
			this.log(`int 21 ah=${ah.toString(16)} ignoriert`);
		}

		musik(ax, bx) {
			if (ax === 1) this.optionen.musik?.('spielen', bx);
			else if (ax === 2) this.optionen.musik?.('stopp');
			else if (ax === 3) this.r[0] = this.optionen.musik?.('abfrage') ?? 0;
		}

		ende(code) {
			this.beendet = true; this.code = code;
			this.optionen.ende?.(code);
		}

		taste(ascii = 13, scan = 0x1c) {
			this.tasten.push((scan << 8) | ascii);
			this.letzteTaste = scan;
			this.angehalten = false;
		}

		// Bild 320×200 als RGBA (Palette 6 Bit → 8 Bit)
		bild(rgba) {
			const pal = new Uint32Array(256);
			for (let i = 0; i < 256; i++) {
				const k = (c) => (this.palette[i * 3 + c] * 255 / 63) | 0;
				pal[i] = 0xff000000 | (k(2) << 16) | (k(1) << 8) | k(0);
			}
			const ziel = new Uint32Array(rgba.buffer, rgba.byteOffset, 64000);
			for (let i = 0; i < 64000; i++) ziel[i] = pal[this.m[0xa0000 + i]];
		}
	}

	Intro.CPU_HZ = CPU_HZ;
	global.Intro = Intro;
	if (typeof module !== 'undefined') module.exports = Intro;
})(typeof window !== 'undefined' ? window : globalThis);
