// Fasst ein .cpuprofile zusammen: Eigenzeit (self) und Gesamtzeit (total) pro Funktion.
import fs from 'node:fs';
const p = JSON.parse(fs.readFileSync(process.argv[2]));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const dt = new Map();
for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const self = new Map(), total = new Map();
for (const [id, t] of dt) {
	const n = byId.get(id);
	const name = n.callFrame.functionName || '(anonym)';
	self.set(name, (self.get(name) || 0) + t);
	const gesehen = new Set();
	for (let k = id; k !== undefined; k = parent.get(k)) {
		const nm = byId.get(k).callFrame.functionName || '(anonym)';
		if (!gesehen.has(nm)) { gesehen.add(nm); total.set(nm, (total.get(nm) || 0) + t); }
	}
}
const ms = (t) => (t / 1000).toFixed(0).padStart(6);
const zeige = (titel, m) => {
	console.log(`\n${titel}`);
	[...m].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[3] || 25)).forEach(([n, t]) => console.log(ms(t), 'ms ', n));
};
zeige('EIGENZEIT', self);
zeige('GESAMTZEIT', total);
