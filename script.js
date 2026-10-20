/* Numéro WhatsApp du restaurant, format international sans "+" ni espaces
   (ex. Mali : "223XXXXXXXX"). Laissé vide, WhatsApp demande de choisir le contact. */
const NUMERO_WHATSAPP = "";

document.addEventListener("DOMContentLoaded", () => {

    /* ---------- 1. Apparition des sections au défilement ---------- */
    const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));

    /* ---------- 2. Barre de menu : hauteur réelle + lien actif ---------- */
    const nav = document.getElementById("menu-nav");
    const liens = [...document.querySelectorAll(".nav-link")];
    const sections = liens.map(l => document.querySelector(l.getAttribute("href"))).filter(Boolean);

    // La marge d'ancrage (CSS) suit la vraie hauteur de la barre, même sur 2 lignes
    function majHauteurNav() {
        document.documentElement.style.setProperty("--nav-h", nav.offsetHeight + "px");
    }
    majHauteurNav();
    window.addEventListener("resize", majHauteurNav);

    let actif = null;
    let verrou = false;   // pendant un défilement déclenché par un clic

    function activer(id) {
        if (id === actif) return;
        actif = id;
        liens.forEach(l => {
            const estActif = l.getAttribute("href") === "#" + id;
            l.classList.toggle("active", estActif);
            // On fait défiler seulement la barre (jamais la page, ce qui perturbait le défilement)
            if (estActif && nav.scrollWidth > nav.clientWidth) {
                nav.scrollTo({ left: l.offsetLeft - (nav.clientWidth - l.offsetWidth) / 2, behavior: "smooth" });
            }
        });
    }

    function majActif() {
        if (verrou) return;
        const repere = nav.offsetHeight + 40;
        const dessus = sections.filter(s => s.getBoundingClientRect().top <= repere);
        if (!dessus.length) { activer(null); return; }
        const hautMax = Math.max(...dessus.map(s => s.getBoundingClientRect().top));
        // Deux sections côte à côte ont le même haut : on garde celle déjà active
        const egales = dessus.filter(s => Math.abs(s.getBoundingClientRect().top - hautMax) < 2);
        const garder = egales.find(s => s.id === actif);
        activer((garder || egales[0]).id);
    }

    let attente = false;
    window.addEventListener("scroll", () => {
        if (attente) return;
        attente = true;
        requestAnimationFrame(() => { majActif(); attente = false; });
    }, { passive: true });
    majActif();

    // Clic sur un lien : on active tout de suite et on fige le suivi jusqu'à l'arrivée
    liens.forEach(l => l.addEventListener("click", () => {
        verrou = true;
        activer(l.getAttribute("href").slice(1));
        const fin = () => { verrou = false; };
        if ("onscrollend" in window) window.addEventListener("scrollend", fin, { once: true });
        setTimeout(fin, 1200);   // filet de sécurité
    }));

    /* ---------- 3. Photos des plats : agrandissement (lightbox) ---------- */
    const photos = [...document.querySelectorAll(".plat-photo")];
    const lightbox = document.getElementById("lightbox");
    const lbImg = document.getElementById("lightbox-img");
    const lbLegende = document.getElementById("lightbox-legende");
    let indexCourant = 0;
    let dernierFocus = null;

    // Photo introuvable : on la retire pour ne pas afficher d'icône cassée.
    // On teste toutes les photos dès le départ (et non au fil du défilement) :
    // retirer une photo pendant qu'on défile ferait sauter la page.
    photos.forEach(img => {
        img.addEventListener("error", () => img.remove());
        const test = new Image();
        test.onerror = () => img.remove();
        test.src = img.getAttribute("src");
    });

    function afficher(i) {
        const visibles = photos.filter(p => p.isConnected);
        if (!visibles.length) return;
        indexCourant = (i + visibles.length) % visibles.length;
        const p = visibles[indexCourant];
        lbImg.src = p.src;
        lbImg.alt = p.alt;
        lbLegende.textContent = p.alt;
    }

    function ouvrir(img) {
        dernierFocus = document.activeElement;
        const visibles = photos.filter(p => p.isConnected);
        afficher(visibles.indexOf(img));
        lightbox.classList.remove("cache");
        document.body.style.overflow = "hidden";
        lightbox.querySelector(".lightbox-fermer").focus({ preventScroll: true });
    }

    function fermer() {
        lightbox.classList.add("cache");
        document.body.style.overflow = "";
        if (dernierFocus) dernierFocus.focus({ preventScroll: true });
    }

    photos.forEach(img => {
        img.addEventListener("click", () => ouvrir(img));
        img.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(img); }
        });
    });

    lightbox.querySelector(".lightbox-fermer").addEventListener("click", fermer);
    lightbox.querySelector(".lightbox-prec").addEventListener("click", () => afficher(indexCourant - 1));
    lightbox.querySelector(".lightbox-suiv").addEventListener("click", () => afficher(indexCourant + 1));
    lightbox.addEventListener("click", e => { if (e.target === lightbox) fermer(); }); // clic sur le fond

    document.addEventListener("keydown", e => {
        if (lightbox.classList.contains("cache")) return;
        if (e.key === "Escape") fermer();
        if (e.key === "ArrowLeft") afficher(indexCourant - 1);
        if (e.key === "ArrowRight") afficher(indexCourant + 1);
    });

    /* ---------- 4. Panier et commande par WhatsApp ---------- */
    const panier = new Map();           // nom -> { prix, quantite }
    const zonePanier = document.getElementById("panier-flottant");
    const compteur = document.getElementById("compteur-article");

    function majPanier() {
        let total = 0;
        panier.forEach(a => total += a.quantite);
        compteur.textContent = total;
        zonePanier.classList.toggle("cache", total === 0);
    }

    document.querySelectorAll(".btn-ajouter").forEach(btn => {
        btn.addEventListener("click", () => {
            const nom = btn.dataset.nom.trim();
            const prix = Number(btn.dataset.prix);
            const article = panier.get(nom) || { prix, quantite: 0 };
            article.quantite++;
            panier.set(nom, article);
            btn.closest("li").classList.add("plat-selectionne");
            majPanier();
        });
    });

    document.getElementById("btn-commander").addEventListener("click", () => {
        let total = 0;
        const lignes = [];
        panier.forEach((a, nom) => {
            total += a.prix * a.quantite;
            lignes.push(`• ${a.quantite} x ${nom} – ${(a.prix * a.quantite).toLocaleString("fr-FR")} F`);
        });
        const message = `Bonjour SUKAL, je voudrais commander :\n${lignes.join("\n")}\n\nTotal : ${total.toLocaleString("fr-FR")} F`;
        window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
    });
});
