/**
 * ECKVEK — Main Page Script (index.html)
 * Scroll reveal, Lightbox, Smooth scroll, Hamburger menu
 */
document.addEventListener('DOMContentLoaded', () => {

    // ── Hamburger Menu ──
    const hamburger = document.getElementById('hamburger');
    const nav = document.querySelector('.nav');
    if (hamburger && nav) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            nav.classList.toggle('open');
        });
        // Close menu when clicking a link
        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                nav.classList.remove('open');
            });
        });
    }

    // ── Scroll Reveal Animations ──
    const animatedElements = document.querySelectorAll('.service-card, .about-card, .work-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    animatedElements.forEach(el => observer.observe(el));

    // ── Lightbox ──
    const overlay = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbCaption = document.getElementById('lightbox-caption');
    const lbClose = document.getElementById('lightbox-close');

    document.querySelectorAll('.work-card .card-image-wrapper img').forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            lbImg.src = img.src;
            lbImg.alt = img.alt;
            lbCaption.textContent = img.alt;
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeLightbox() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    overlay.addEventListener('click', closeLightbox);
    lbClose.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    // ── Smooth Scroll for Anchor Links ──
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
