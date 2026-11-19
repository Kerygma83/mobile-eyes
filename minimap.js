// Minimap im mobilen Layout: links neben dem Steuerkreuz die Automap der Stadt bzw. der
// Dungeon-Ebene, bei jedem Bild des Hauptbildschirms abgeglichen. Das Spiel meldet über
// web_minimap() (BrightEyes minimap.cpp) die erkundeten Felder mit den Farben der Automap
// (seg074 render_automap), Position und Blickrichtung; gezeichnet wird hier, das Spiel bleibt
// unverändert. Karten mit 32 Spalten (Thorwal, Prem, Phexcaer) zeigen 16 Spalten um die Gruppe.

// g_palette_fight2 (seg074), 6 Bit je Kanal
const MINIMAP_PALETTE = [
	[0x00, 0x00, 0x00], [0x3f, 0x00, 0x00], [0x00, 0x3f, 0x00], [0x00, 0x00, 0x3f], [0x3f, 0x3f, 0x00],
	[0x3f, 0x00, 0x3f], [0x00, 0x3f, 0x3f], [0x3f, 0x1f, 0x1f], [0x1f, 0x1f, 0x3f], [0x0f, 0x1f, 0x0f],
	[0x0f, 0x0f, 0x1f], [0x20, 0x05, 0x00], [0x3f, 0x1f, 0x00], [0x3f, 0x00, 0x1f], [0x28, 0x22, 0x00],
	[0x1f, 0x1f, 0x1f], [0x20, 0x00, 0x33], [0x27, 0x13, 0x00], [0x00, 0x30, 0x00], [0x0a, 0x0a, 0x0a],
].map(([r, g, b]) => `rgb(${Math.round(r * 255 / 63)} ${Math.round(g * 255 / 63)} ${Math.round(b * 255 / 63)})`);
const MINIMAP_GELB = 4, MINIMAP_LILA = 16;

function minimapEinrichten(Module, { canvas, an }) {
	const F = 12;                 // Pixel je Feld im Canvas (16 × 16 Felder)
	canvas.width = canvas.height = 16 * F;
	const ctx = canvas.getContext('2d');
	let stand = null;

	function pfeil(x, y, d, farbe) {
		const m = F / 2, r = F * 0.42;
		ctx.save();
		ctx.translate(x * F + m, y * F + m);
		ctx.rotate(d * Math.PI / 2);   // 0 Nord, 1 Ost, 2 Süd, 3 West
		ctx.beginPath();
		ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, r); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * 0.85, r);
		ctx.closePath();
		ctx.fillStyle = farbe; ctx.fill();
		ctx.lineWidth = 1.2; ctx.strokeStyle = '#000'; ctx.stroke();
		ctx.restore();
	}

	function zeichnen(k) {
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		if (k.dunkel) {
			ctx.fillStyle = '#777';
			ctx.font = `${F * 1.4}px sans-serif`;
			ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
			ctx.fillText('Zu dunkel', canvas.width / 2, canvas.height / 2);
			return;
		}
		// Ausschnitt: bei 32 Spalten 16 um die Gruppe, am Rand anliegend
		const x0 = k.w === 16 ? 0 : Math.max(0, Math.min(k.w - 16, k.x - 8));
		for (let y = 0; y < 16; y++) {
			for (let x = 0; x < 16; x++) {
				const v = parseInt(k.felder.substr(2 * ((x + x0) + y * k.w), 2), 16);
				if (v === 0xff) continue;
				const farbe = v & 0x1f, eingang = (v >> 5) - 1;
				ctx.fillStyle = MINIMAP_PALETTE[farbe] ?? '#f0f';
				ctx.fillRect(x * F, y * F, F - 1, F - 1);
				if (eingang >= 0) {   // Eingang: schwarzer Strich an der Seite (wie draw_automap_entrance)
					const s = Math.round(F * 0.45), a = Math.round((F - 1 - s) / 2), t = 2;
					ctx.fillStyle = '#000';
					if (eingang === 0) ctx.fillRect(x * F + a, y * F, s, t);
					else if (eingang === 1) ctx.fillRect(x * F + F - 1 - t, y * F + a, t, s);
					else if (eingang === 2) ctx.fillRect(x * F + a, y * F + F - 1 - t, s, t);
					else ctx.fillRect(x * F, y * F + a, t, s);
				}
			}
		}
		for (const [gx, gy, gd] of k.gruppen) {
			if (gx - x0 >= 0 && gx - x0 < 16) pfeil(gx - x0, gy, gd, MINIMAP_PALETTE[MINIMAP_LILA] ?? 'rgb(128 0 204)');
		}
		pfeil(k.x - x0, k.y, k.d, MINIMAP_PALETTE[MINIMAP_GELB]);
	}

	return {
		// bei jedem Bild des Hauptbildschirms; liefert, ob die Minimap zu sehen ist
		aktualisieren() {
			const json = an() && Module._web_minimap ? Module.UTF8ToString(Module._web_minimap()) : '';
			if (json !== stand) {
				stand = json;
				if (json) zeichnen(JSON.parse(json));
			}
			document.body.classList.toggle('minimap', !!json);
			return !!json;
		},
		aus() { document.body.classList.remove('minimap'); },
		get stand() { return stand ? JSON.parse(stand) : null; },
	};
}
