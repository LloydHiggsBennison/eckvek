/** Electric hero: pooled paths, batched strokes and a cached node halo. */
(function () {
    const canvas = document.getElementById('lightning-canvas');
    if (!canvas) return;
    const mobile = window.matchMedia('(max-width: 768px), (hover: none) and (pointer: coarse)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hero = canvas.parentElement;
    const NODE_COUNT = 32;
    const MAX_LINKS = 96;
    const LINK_DISTANCE = 180;
    const DEPTH = 600;
    const FOV = 500;
    const FRAME_MS = 1000 / 30;
    const nodes = [];
    const links = [];
    const projected = [];
    let ctx = null;
    let halo = null;
    let unavailable = false;
    let inView = !('IntersectionObserver' in window);
    let frameId = null;
    let lastFrame = null;
    let activeTime = 0;
    let nextLinkUpdate = 0;
    let nextPulse = 6;
    let pulsePath = null;
    let pulseLife = 0;
    let W = 0;
    let H = 0;
    let linkCount = 0;

    function allowed() {
        return !unavailable && !mobile.matches && !reducedMotion.matches && !document.hidden && inView;
    }
    function resize() {
        if (!ctx || !allowed()) return;
        const oldW = W;
        const oldH = H;
        W = hero.clientWidth;
        H = hero.clientHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(W * ratio);
        const height = Math.round(H * ratio);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (oldW !== W || oldH !== H) {
            if (oldW && oldH) {
                for (const node of nodes) { node.x *= W / oldW; node.y *= H / oldH; }
            }
            pulsePath = null;
            pulseLife = 0;
            nextLinkUpdate = 0;
        }
    }
    function initialize() {
        if (ctx) return true;
        ctx = canvas.getContext('2d');
        if (!ctx) { unavailable = true; canvas.hidden = true; return false; }
        resize();
        for (let i = 0; i < NODE_COUNT; i++) {
            nodes.push({
                x: (Math.random() - 0.5) * W * 1.4,
                y: (Math.random() - 0.5) * H * 1.4,
                z: Math.random() * DEPTH,
                vx: (Math.random() - 0.5) * 9,
                vy: (Math.random() - 0.5) * 9,
                vz: -4.5 - Math.random() * 7.5,
                size: 1 + Math.random() * 2,
                pulse: Math.random() * Math.PI * 2,
            });
            projected.push({ x: 0, y: 0, scale: 0, radius: 0, alpha: 0 });
        }
        // Fixed pools: no new point arrays, node objects or sorting per frame.
        for (let i = 0; i < MAX_LINKS; i++) {
            links.push({ a: 0, b: 0, segments: 0, bucket: 0, offsets: new Float32Array(32) });
        }
        halo = document.createElement('canvas');
        halo.width = halo.height = 64;
        const haloContext = halo.getContext('2d');
        if (haloContext) {
            const gradient = haloContext.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(0, 200, 240, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 180, 216, 0)');
            haloContext.fillStyle = gradient;
            haloContext.fillRect(0, 0, 64, 64);
        } else halo = null;
        if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
        else window.addEventListener('resize', resize);
        return true;
    }
    function updateNodes(seconds) {
        for (let i = 0; i < NODE_COUNT; i++) {
            const node = nodes[i];
            node.x += node.vx * seconds;
            node.y += node.vy * seconds;
            node.z += node.vz * seconds;
            node.pulse += 0.6 * seconds;
            if (node.z < -50) {
                node.z = DEPTH;
                node.x = (Math.random() - 0.5) * W * 1.4;
                node.y = (Math.random() - 0.5) * H * 1.4;
            }
            const point = projected[i];
            point.scale = FOV / (FOV + node.z);
            point.x = W / 2 + node.x * point.scale;
            point.y = H / 2 + node.y * point.scale;
            point.radius = node.size * point.scale;
            point.alpha = point.scale * (0.6 + 0.4 * Math.sin(node.pulse));
        }
    }
    function updateLinks() {
        linkCount = 0;
        for (let i = 0; i < NODE_COUNT && linkCount < MAX_LINKS; i++) {
            for (let j = i + 1; j < NODE_COUNT && linkCount < MAX_LINKS; j++) {
                const a = projected[i];
                const b = projected[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const squared = dx * dx + dy * dy;
                if (squared >= LINK_DISTANCE * LINK_DISTANCE) continue;
                const distance = Math.sqrt(squared);
                const alpha = (1 - distance / LINK_DISTANCE) * Math.min(a.scale, b.scale) * 0.5;
                if (alpha <= 0.02) continue;
                const link = links[linkCount++];
                link.a = i;
                link.b = j;
                link.segments = Math.min(15, Math.max(4, Math.floor(distance / 20)));
                link.bucket = alpha < 0.12 ? 0 : alpha < 0.24 ? 1 : 2;
                const jitter = 4 + distance * 0.04;
                for (let k = 1; k < link.segments; k++) {
                    link.offsets[k * 2] = (Math.random() - 0.5) * jitter;
                    link.offsets[k * 2 + 1] = (Math.random() - 0.5) * jitter;
                }
            }
        }
        nextLinkUpdate = activeTime + 0.1;
    }
    function drawLinks() {
        // Three opacity groups, two strokes each; no per-link shadow blur.
        for (let bucket = 0; bucket < 3; bucket++) {
            let count = 0;
            ctx.beginPath();
            for (let i = 0; i < linkCount; i++) {
                const link = links[i];
                if (link.bucket !== bucket) continue;
                const a = projected[link.a];
                const b = projected[link.b];
                ctx.moveTo(a.x, a.y);
                for (let k = 1; k < link.segments; k++) {
                    const t = k / link.segments;
                    ctx.lineTo(a.x + (b.x - a.x) * t + link.offsets[k * 2],
                        a.y + (b.y - a.y) * t + link.offsets[k * 2 + 1]);
                }
                ctx.lineTo(b.x, b.y);
                count++;
            }
            if (!count) continue;
            const alpha = bucket === 0 ? 0.08 : bucket === 1 ? 0.18 : 0.32;
            ctx.globalAlpha = alpha * 0.25;
            ctx.strokeStyle = '#00b4d8';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = alpha * 0.6;
            ctx.strokeStyle = '#8ce1ff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    function drawNodes() {
        ctx.fillStyle = '#b4f0ff';
        for (const point of projected) {
            if (point.alpha < 0.03) continue;
            if (halo) {
                ctx.globalAlpha = point.alpha;
                const radius = point.radius * 8;
                ctx.drawImage(halo, point.x - radius, point.y - radius, radius * 2, radius * 2);
            }
            ctx.globalAlpha = point.alpha * 0.8;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(0.5, point.radius), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    function spawnPulse() {
        const y = H * (0.25 + Math.random() * 0.5);
        pulsePath = new Path2D();
        pulsePath.moveTo(0, y);
        let x = 0;
        while (x < W) {
            x += 15 + Math.random() * 25;
            const spike = Math.random() < 0.08;
            const offset = spike ? (Math.random() > 0.5 ? -1 : 1) * (60 + Math.random() * 80)
                : (Math.random() - 0.5) * 20;
            pulsePath.lineTo(x, y + offset);
        }
        pulseLife = 1;
        nextPulse = activeTime + 6 + Math.random() * 4;
    }
    function drawPulse(seconds) {
        if (activeTime >= nextPulse) spawnPulse();
        if (!pulsePath || pulseLife <= 0) return;
        ctx.globalAlpha = pulseLife * 0.15;
        ctx.strokeStyle = '#00b4d8';
        ctx.lineWidth = 8;
        ctx.shadowColor = 'rgba(0, 180, 216, 0.8)';
        ctx.shadowBlur = 30;
        ctx.stroke(pulsePath);
        ctx.globalAlpha = pulseLife * 0.5;
        ctx.strokeStyle = '#b4f0ff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 220, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.stroke(pulsePath);
        ctx.shadowBlur = 0;
        pulseLife -= 0.36 * seconds;
    }
    function animate(time) {
        frameId = null;
        if (!allowed()) return;
        if (lastFrame !== null && time - lastFrame < FRAME_MS - 0.5) {
            frameId = requestAnimationFrame(animate);
            return;
        }
        const seconds = lastFrame === null ? 1 / 30 : Math.min((time - lastFrame) / 1000, 0.1);
        lastFrame = time;
        activeTime += seconds;
        ctx.clearRect(0, 0, W, H);
        updateNodes(seconds);
        if (activeTime >= nextLinkUpdate) updateLinks();
        ctx.lineJoin = 'bevel';
        drawLinks();
        drawNodes();
        drawPulse(seconds);
        ctx.globalAlpha = 1;
        frameId = requestAnimationFrame(animate);
    }
    function syncAnimation() {
        canvas.hidden = unavailable || mobile.matches || reducedMotion.matches;
        if (allowed() && initialize()) {
            resize();
            if (frameId === null) frameId = requestAnimationFrame(animate);
        } else {
            if (frameId !== null) cancelAnimationFrame(frameId);
            frameId = null;
            lastFrame = null;
            if (canvas.width !== 0) canvas.width = 0;
            if (canvas.height !== 0) canvas.height = 0;
        }
    }
    mobile.addEventListener('change', syncAnimation);
    reducedMotion.addEventListener('change', syncAnimation);
    document.addEventListener('visibilitychange', syncAnimation);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncAnimation(); }).observe(hero);
    }
    syncAnimation();
})();
