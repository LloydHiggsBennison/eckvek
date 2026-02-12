/**
 * Electric Network 3D — ECKVEK Hero Background
 * Vanta-style 3D electric network with floating nodes,
 * lightning arcs between them, and depth perspective.
 */
(function () {
    const canvas = document.getElementById('lightning-canvas');
    if (!canvas) return;

    // Disable animation entirely on mobile devices for performance
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
        canvas.style.display = 'none';
        return;
    }

    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;

    let W, H;
    function resize() {
        W = hero.offsetWidth;
        H = hero.offsetHeight;
        canvas.width = W * 2;
        canvas.height = H * 2;
        ctx.setTransform(2, 0, 0, 2, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    /* --- 3D Node System --- */
    const NODE_COUNT = 55;
    const DEPTH = 600;
    const CONNECTION_DIST = 180;
    const nodes = [];

    function createNode() {
        return {
            x: (Math.random() - 0.5) * W * 1.4,
            y: (Math.random() - 0.5) * H * 1.4,
            z: Math.random() * DEPTH,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            vz: -0.15 - Math.random() * 0.25,
            size: 1 + Math.random() * 2,
            pulse: Math.random() * Math.PI * 2,
        };
    }

    for (let i = 0; i < NODE_COUNT; i++) nodes.push(createNode());

    /* --- Project 3D → 2D --- */
    const FOV = 500;
    function project(node) {
        const scale = FOV / (FOV + node.z);
        return {
            x: W / 2 + node.x * scale,
            y: H / 2 + node.y * scale,
            s: scale,
            z: node.z,
        };
    }

    /* --- Draw electric arc between two projected points --- */
    function drawArc(p1, p2, alpha, time) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const segments = Math.max(4, Math.floor(dist / 20));
        const jag = 4 + dist * 0.04;

        // Build jagged path
        const points = [{ x: p1.x, y: p1.y }];
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            points.push({
                x: p1.x + dx * t + (Math.random() - 0.5) * jag,
                y: p1.y + dy * t + (Math.random() - 0.5) * jag,
            });
        }
        points.push({ x: p2.x, y: p2.y });

        // Outer glow
        ctx.save();
        ctx.globalAlpha = alpha * 0.25;
        ctx.strokeStyle = 'rgba(0, 180, 216, 1)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0, 180, 216, 0.7)';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();

        // Core
        ctx.save();
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = 'rgba(140, 225, 255, 0.85)';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.4)';
        ctx.shadowBlur = 6;
        ctx.lineJoin = 'bevel';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();
    }

    /* --- Sporadic main lightning bolt --- */
    let mainBolt = null;
    let mainBoltTimer = 0;

    function spawnMainBolt() {
        const y = H * (0.25 + Math.random() * 0.5);
        const points = [{ x: 0, y: y }];
        let cx = 0;
        while (cx < W) {
            const step = 15 + Math.random() * 25;
            cx += step;
            // Occasionally make a big spike (heartbeat R-wave)
            const isSpike = Math.random() < 0.08;
            const jy = isSpike
                ? (Math.random() > 0.5 ? -1 : 1) * (60 + Math.random() * 80)
                : (Math.random() - 0.5) * 20;
            points.push({ x: cx, y: y + jy });
        }
        mainBolt = { points, life: 1.0, decay: 0.012 };
    }

    function drawMainBolt() {
        if (!mainBolt || mainBolt.life <= 0) return;
        const a = mainBolt.life;

        // Wide glow
        ctx.save();
        ctx.globalAlpha = a * 0.15;
        ctx.strokeStyle = 'rgba(0, 180, 216, 1)';
        ctx.lineWidth = 8;
        ctx.shadowColor = 'rgba(0, 180, 216, 0.8)';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.moveTo(mainBolt.points[0].x, mainBolt.points[0].y);
        for (let i = 1; i < mainBolt.points.length; i++) {
            ctx.lineTo(mainBolt.points[i].x, mainBolt.points[i].y);
        }
        ctx.stroke();
        ctx.restore();

        // Core
        ctx.save();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = 'rgba(180, 240, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 220, 255, 0.5)';
        ctx.shadowBlur = 10;
        ctx.lineJoin = 'bevel';
        ctx.beginPath();
        ctx.moveTo(mainBolt.points[0].x, mainBolt.points[0].y);
        for (let i = 1; i < mainBolt.points.length; i++) {
            ctx.lineTo(mainBolt.points[i].x, mainBolt.points[i].y);
        }
        ctx.stroke();
        ctx.restore();

        mainBolt.life -= mainBolt.decay;
    }

    /* --- Main animation loop --- */
    function animate(time) {
        ctx.clearRect(0, 0, W, H);

        // Move nodes
        nodes.forEach(n => {
            n.x += n.vx;
            n.y += n.vy;
            n.z += n.vz;
            n.pulse += 0.02;

            // Reset when node passes camera
            if (n.z < -50) {
                n.z = DEPTH;
                n.x = (Math.random() - 0.5) * W * 1.4;
                n.y = (Math.random() - 0.5) * H * 1.4;
            }
        });

        // Project all nodes
        const projected = nodes.map((n, i) => ({ ...project(n), idx: i, node: n }));
        // Sort by depth (far first)
        projected.sort((a, b) => b.z - a.z);

        // Draw connections between close nodes
        for (let i = 0; i < projected.length; i++) {
            for (let j = i + 1; j < projected.length; j++) {
                const a = projected[i];
                const b = projected[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < CONNECTION_DIST) {
                    const depthFade = Math.min(a.s, b.s);
                    const distFade = 1 - dist / CONNECTION_DIST;
                    const alpha = distFade * depthFade * 0.5;

                    // Draw as electric arc (re-jags each frame for flicker)
                    if (alpha > 0.02) {
                        drawArc(a, b, alpha, time);
                    }
                }
            }
        }

        // Draw nodes
        projected.forEach(p => {
            const glow = 0.6 + 0.4 * Math.sin(p.node.pulse);
            const radius = p.node.size * p.s;
            const alpha = p.s * glow;

            if (alpha < 0.03) return;

            // Node glow halo
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 8);
            grad.addColorStop(0, `rgba(0, 200, 240, ${alpha * 0.2})`);
            grad.addColorStop(1, 'rgba(0, 180, 216, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(p.x - radius * 8, p.y - radius * 8, radius * 16, radius * 16);

            // Bright center
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, radius), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(180, 240, 255, ${alpha * 0.8})`;
            ctx.fill();
        });

        // Sporadic full-width lightning bolt
        mainBoltTimer++;
        if (mainBoltTimer > 180 + Math.random() * 200) {
            spawnMainBolt();
            mainBoltTimer = 0;
        }
        drawMainBolt();

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
})();
