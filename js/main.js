/** Shared progressive navigation, image viewer and scroll reveal. */
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('primary-nav');
    const mobile = window.matchMedia('(max-width: 768px)');
    if (hamburger && nav) {
        function setMenu(open, restoreFocus = false) {
            open = mobile.matches && open;
            hamburger.classList.toggle('active', open);
            hamburger.setAttribute('aria-expanded', String(open));
            hamburger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            nav.classList.toggle('open', open);
            nav.inert = mobile.matches && !open;
            if (restoreFocus) hamburger.focus();
        }
        document.documentElement.classList.add('menu-ready');
        setMenu(false);
        hamburger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
        nav.addEventListener('click', event => {
            if (event.target.closest('a')) setMenu(false);
        });
        document.addEventListener('click', event => {
            if (!event.target.closest('header')) setMenu(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && nav.classList.contains('open')) setMenu(false, true);
        });
        document.addEventListener('focusin', event => {
            if (!event.target.closest('header')) setMenu(false);
        });
        mobile.addEventListener('change', () => setMenu(false));
    }
    const cards = document.querySelectorAll('.service-card, .about-card, .work-card, .gallery-card, .cert-card');
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.remove('reveal-pending');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        cards.forEach(card => {
            card.classList.add('reveal-pending');
            observer.observe(card);
        });
    }
    const dialog = document.getElementById('lightbox');
    const image = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    const closeButton = document.getElementById('lightbox-close');
    if (dialog && image && caption && closeButton && typeof dialog.showModal === 'function') {
        let previousFocus;
        let previousOverflow;
        document.querySelectorAll('.image-trigger').forEach(trigger => {
            trigger.addEventListener('click', event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                const source = trigger.parentElement.querySelector('img');
                image.src = trigger.href;
                image.alt = source.alt;
                caption.textContent = source.alt;
                previousFocus = trigger;
                previousOverflow = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
                dialog.showModal();
                closeButton.focus();
            });
        });
        closeButton.addEventListener('click', () => dialog.close());
        dialog.addEventListener('keydown', event => {
            // This viewer has one interactive control. Keep Tab inside it,
            // including browsers that otherwise move focus to their chrome.
            if (event.key === 'Tab') {
                event.preventDefault();
                closeButton.focus();
            }
        });
        dialog.addEventListener('click', event => {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener('close', () => {
            document.body.style.overflow = previousOverflow ?? '';
            image.removeAttribute('src');
            previousFocus?.focus({ preventScroll: true });
        });
    }
});
