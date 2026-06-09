import { useState, useEffect, useRef } from "react";
import { Link } from 'react-router-dom';

const COLORS = {
  primary: "#1565C0",
  primaryLight: "#1976D2",
  primaryDark: "#0D47A1",
  secondary: "#00897B",
  accent: "#E3F2FD",
  white: "#FFFFFF",
  gray50: "#F8FAFC",
  gray600: "#4B5563",
  gray700: "#374151",
  gray900: "#111827",
  danger: "#E53935",
};

const IMG = {
  hero: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=900&q=80",
  heroDoc: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80",
  clinic1: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
  clinic2: "https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=800&q=80",
  about: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&q=80",
  doc1: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
  doc2: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&q=80",
  doc3: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
  doc4: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&q=80",
  srvConsult: "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400&q=80",
  srvPed: "https://images.unsplash.com/photo-1607962837359-5e7e89f86776?w=400&q=80",
  srvMat: "https://images.unsplash.com/photo-1555421689-491a97ff2040?w=400&q=80",
  srvPharma: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&q=80",
  srvLab: "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=400&q=80",
  srvImag: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400&q=80",
  srvHosp: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&q=80",
  srvUrg: "https://images.unsplash.com/photo-1542884748-2b87b269a88a?w=400&q=80",
  art1: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80",
  art2: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
  art3: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&q=80",
  mobile: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80",
  pat1: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&q=80",
  pat2: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
  pat3: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
  equip: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=600&q=80",
  team: "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=600&q=80",
};

const style = {
  navLink: {
    color: COLORS.gray700, textDecoration: "none", fontSize: "14px",
    fontWeight: "500", padding: "6px 4px", cursor: "pointer",
    transition: "color 0.2s", whiteSpace: "nowrap",
  },
  btn: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "10px 22px", borderRadius: "50px", border: "none",
    fontWeight: "600", fontSize: "14px", cursor: "pointer",
    transition: "all 0.2s", textDecoration: "none",
  },
  card: {
    background: COLORS.white, borderRadius: "16px", padding: "0",
    boxShadow: "0 4px 24px rgba(21,101,192,0.09)",
    border: "1px solid #EFF6FF", transition: "transform 0.2s, box-shadow 0.2s",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: "clamp(28px,4vw,40px)", fontWeight: "800",
    color: COLORS.gray900, textAlign: "center", marginBottom: "12px",
  },
  sectionSub: {
    fontSize: "16px", color: COLORS.gray600, textAlign: "center",
    maxWidth: "600px", margin: "0 auto 52px", lineHeight: "1.8",
  },
  badge: {
    display: "inline-block", background: COLORS.accent, color: COLORS.primary,
    fontSize: "13px", fontWeight: "600", padding: "4px 14px",
    borderRadius: "50px", marginBottom: "16px", letterSpacing: "0.5px",
  },
};

const services = [
  { icon: "🩺", title: "Consultation Générale", desc: "Prise en charge globale par nos médecins généralistes expérimentés.", img: IMG.srvConsult },
  { icon: "👶", title: "Pédiatrie", desc: "Suivi complet de la santé de vos enfants de la naissance à l'adolescence.", img: IMG.srvPed },
  { icon: "🤰", title: "Maternité", desc: "Accompagnement personnalisé tout au long de votre grossesse.", img: IMG.srvMat },
  { icon: "💊", title: "Pharmacie", desc: "Médicaments et conseils pharmaceutiques disponibles sur place.", img: IMG.srvPharma },
  { icon: "🔬", title: "Laboratoire", desc: "Analyses biologiques fiables avec résultats rapides en ligne.", img: IMG.srvLab },
  { icon: "🖥️", title: "Imagerie", desc: "IRM, scanner, radiologie numérique et échographie de pointe.", img: IMG.srvImag },
  { icon: "🏥", title: "Hospitalisation", desc: "Chambres individuelles modernes avec suivi médical 24h/24.", img: IMG.srvHosp },
  { icon: "🚑", title: "Urgences", desc: "Service d'urgence opérationnel 24h/24 et 7j/7 sans rendez-vous.", img: IMG.srvUrg },
];

const stats = [
  { value: "10 000+", label: "Patients suivis", icon: "👥" },
  { value: "50+", label: "Professionnels", icon: "👨‍⚕️" },
  { value: "15+", label: "Services médicaux", icon: "🏥" },
  { value: "24h/24", label: "Service urgence", icon: "🚑" },
];

const whyUs = [
  { icon: "🎓", title: "Personnel qualifié", desc: "Médecins et spécialistes avec plus de 10 ans d'expérience.", img: IMG.team },
  { icon: "🔬", title: "Équipements modernes", desc: "Technologies médicales de dernière génération.", img: IMG.equip },
  { icon: "⚡", title: "Disponibilité", desc: "Prise en charge rapide, rendez-vous en 24h.", img: IMG.clinic1 },
  { icon: "📱", title: "Dossier numérique", desc: "Accédez à votre dossier médical sécurisé partout.", img: IMG.mobile },
];

const doctors = [
  { name: "Dr. Sarah Benali", specialty: "Cardiologue", exp: "15 ans d'expérience", img: IMG.doc1, color: "#1565C0" },
  { name: "Dr. Mohamed Khelifi", specialty: "Pédiatre", exp: "12 ans d'expérience", img: IMG.doc2, color: "#00897B" },
  { name: "Dr. Amina Cherif", specialty: "Gynécologue", exp: "10 ans d'expérience", img: IMG.doc3, color: "#7B1FA2" },
  { name: "Dr. Karim Zouari", specialty: "Chirurgien", exp: "18 ans d'expérience", img: IMG.doc4, color: "#E65100" },
];

const departments = [
  { name: "Médecine Générale", icon: "🩺", img: IMG.srvConsult },
  { name: "Pédiatrie", icon: "👶", img: IMG.srvPed },
  { name: "Maternité", icon: "🤰", img: IMG.srvMat },
  { name: "Gynécologie", icon: "💜", img: IMG.doc3 },
  { name: "Chirurgie", icon: "🔧", img: IMG.srvUrg },
  { name: "Cardiologie", icon: "❤️", img: IMG.equip },
  { name: "Dentisterie", icon: "🦷", img: IMG.clinic1 },
  { name: "Laboratoire", icon: "🔬", img: IMG.srvLab },
];

const steps = [
  { num: "01", title: "Créer un compte", desc: "Inscrivez-vous en quelques minutes et accédez à votre espace patient sécurisé.", icon: "👤" },
  { num: "02", title: "Prendre rendez-vous", desc: "Choisissez le médecin, la date et l'heure qui vous conviennent en ligne.", icon: "📅" },
  { num: "03", title: "Consulter le médecin", desc: "En présentiel ou en téléconsultation selon votre préférence.", icon: "👨‍⚕️" },
  { num: "04", title: "Recevoir les résultats", desc: "Consultez vos ordonnances et résultats d'analyses en ligne.", icon: "📋" },
  { num: "05", title: "Suivre son dossier", desc: "Historique complet, rappels et suivi de vos traitements.", icon: "📱" },
];

const testimonials = [
  { name: "Fatima B.", img: IMG.pat1, text: "Une expérience médicale exceptionnelle. Le personnel est attentionné et les équipements sont vraiment modernes. Je recommande vivement cette clinique.", stars: 5, role: "Patiente — Cardiologie" },
  { name: "Ahmed M.", img: IMG.pat2, text: "Prise en charge rapide et professionnelle. L'application mobile est très pratique pour gérer mes rendez-vous et consulter mes résultats.", stars: 5, role: "Patient — Médecine générale" },
  { name: "Leila K.", img: IMG.pat3, text: "Suivi de grossesse impeccable. Les médecins sont à l'écoute et rassurants. Je me suis sentie accompagnée tout au long de ma grossesse.", stars: 5, role: "Patiente — Maternité" },
];

const articles = [
  { category: "Prévention", title: "5 habitudes pour un cœur en bonne santé", date: "03 Juin 2026", readTime: "4 min", img: IMG.art1 },
  { category: "Vaccination", title: "Calendrier vaccinal 2026 : ce qu'il faut savoir", date: "28 Mai 2026", readTime: "6 min", img: IMG.art2 },
  { category: "Nouveautés", title: "Notre service de téléconsultation est désormais disponible", date: "15 Mai 2026", readTime: "3 min", img: IMG.art3 },
];

const navLinks = ["À propos", "Services", "Médecins", "Départements", "Actualités", "Contact"];

export default function ClinicLanding() {
  const [lang, setLang] = useState("FR");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ nom: "", tel: "", email: "", sujet: "", message: "" });
  const [hovered, setHovered] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => setActiveTestimonial(p => (p + 1) % testimonials.length), 4500);
    return () => clearInterval(intervalRef.current);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleNavClick = (id) => {
    scrollTo(id);
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: COLORS.gray900, overflowX: "hidden", background: COLORS.white }}>
      <style>{`
        @media (max-width: 768px) {
          .hero-section {
            min-height: auto !important;
            align-items: flex-start !important;
            padding-top: 84px !important;
          }

          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding: 28px 20px 42px !important;
          }

          .hero-copy {
            text-align: center;
          }

          .hero-copy p {
            margin-left: auto;
            margin-right: auto;
          }

          .hero-actions {
            justify-content: center;
          }

          .hero-actions button,
          .hero-actions a {
            width: 100%;
            justify-content: center;
          }

          .hero-stats {
            justify-content: center;
            gap: 18px !important;
            margin-top: 32px !important;
          }

          .hero-image {
            order: -1;
          }

          .hero-image-card {
            width: 100% !important;
            max-width: 340px !important;
            height: 280px !important;
            border-radius: 24px !important;
          }

          .hero-floating {
            display: none !important;
          }
        }
      `}</style>

      {/* ─── NAVBAR ─── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(255,255,255,0.97)" : COLORS.white,
        boxShadow: scrolled ? "0 2px 20px rgba(21,101,192,0.13)" : "0 1px 0 #EFF6FF",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "70px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => scrollTo("hero")}>
            <div style={{ width: "42px", height: "42px", background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>🏥</div>
            <div>
              <div style={{ fontWeight: "800", fontSize: "17px", color: COLORS.primary, lineHeight: 1 }}>Clinique Canadienne</div>
              <div style={{ fontSize: "11px", color: COLORS.secondary, fontWeight: "500" }}>de Souanké</div>
            </div>
          </div>

          <div className="hidden lg:flex" style={{ alignItems: "center", gap: "6px" }}>
            {navLinks.map(link => (
              <span key={link} style={style.navLink}
                onClick={() => handleNavClick(link.toLowerCase().replace(/\s/g, "-").replace("à", "a"))}
                onMouseEnter={e => e.target.style.color = COLORS.primary}
                onMouseLeave={e => e.target.style.color = COLORS.gray700}>{link}</span>
            ))}
          </div>

          <div className="hidden lg:flex" style={{ alignItems: "center", gap: "8px" }}>
            {/* Sélecteur de langue */}

            {/* Urgence — lien téléphonique natif */}
            <a
              href="tel:+21600000000"
              style={{ color: COLORS.danger, fontSize: "13px", fontWeight: "700", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
            >
              📞 Urgence
            </a>
            

            {/* Commencer */}
            <Link
              to="/login"
              style={{ ...style.btn, background: COLORS.primary, color: COLORS.white, padding: "7px 16px" }}
            >
              🚀 Commencer
            </Link>
          </div>

          <button
            type="button"
            className="mobile-menu-toggle lg:hidden"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Ouvrir le menu"
            aria-expanded={mobileMenuOpen}
            style={{ width: "42px", height: "42px", borderRadius: "12px", border: `1px solid ${COLORS.accent}`, background: COLORS.white, color: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(21,101,192,0.08)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-menu-panel lg:hidden" style={{ borderTop: "1px solid #EFF6FF", background: "rgba(255,255,255,0.98)", boxShadow: "0 20px 40px rgba(21,101,192,0.12)" }}>
            <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "16px 24px 20px", display: "grid", gap: "14px" }}>
              <div style={{ display: "grid", gap: "10px" }}>
                {navLinks.map(link => (
                  <button
                    key={link}
                    type="button"
                    onClick={() => handleNavClick(link.toLowerCase().replace(/\s/g, "-").replace("à", "a"))}
                    style={{ textAlign: "left", width: "100%", padding: "12px 14px", borderRadius: "14px", border: "1px solid #E5EEF9", background: COLORS.white, color: COLORS.gray700, fontSize: "14px", fontWeight: "600" }}
                  >
                    {link}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "2px", background: COLORS.accent, borderRadius: "20px", padding: "3px" }}>
                  {["FR", "EN", "AR"].map(l => (
                    <button key={l} onClick={() => setLang(l)} style={{ border: "none", borderRadius: "16px", padding: "3px 9px", fontSize: "11px", fontWeight: "700", background: lang === l ? COLORS.primary : "transparent", color: lang === l ? COLORS.white : COLORS.primary, cursor: "pointer", transition: "all 0.2s" }}>{l}</button>
                  ))}
                </div>

                <a href="tel:+21600000000" style={{ color: COLORS.danger, fontSize: "13px", fontWeight: "700", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", padding: "8px 0" }}>
                  📞 Urgence
                </a>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ ...style.btn, justifyContent: "center", background: "transparent", border: `1.5px solid ${COLORS.primary}`, color: COLORS.primary, padding: "11px 16px" }}
                >
                  🔑 Connexion
                </Link>

                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ ...style.btn, justifyContent: "center", background: COLORS.primary, color: COLORS.white, padding: "11px 16px" }}
                >
                  🚀 Commencer
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── HERO ─── */}
      <section id="hero" className="hero-section" style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: "linear-gradient(135deg,#EFF6FF 0%,#E8F5E9 60%,#F3E5F5 100%)", paddingTop: "70px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${IMG.clinic2})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.07 }} />
        <div className="hero-grid" style={{ maxWidth: "1280px", margin: "0 auto", padding: "60px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center", width: "100%", position: "relative" }}>
          <div className="hero-copy">
            <span style={style.badge}>✨ Clinique Certifiée ISO 9001</span>
            <h1 style={{ fontSize: "clamp(36px,5vw,60px)", fontWeight: "900", lineHeight: "1.1", color: COLORS.gray900, marginBottom: "22px" }}>
              Votre santé,<br /><span style={{ color: COLORS.primary }}>notre priorité</span>
            </h1>
            <p style={{ fontSize: "18px", color: COLORS.gray600, lineHeight: "1.8", marginBottom: "36px", maxWidth: "480px" }}>
              Une clinique moderne offrant des soins de qualité avec une gestion médicale entièrement numérique. Prenez soin de vous avec des experts dédiés.
            </p>
            <div className="hero-actions" style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <button onClick={() => scrollTo("contact")} style={{ ...style.btn, background: COLORS.primary, color: COLORS.white, fontSize: "15px", padding: "14px 30px", boxShadow: "0 8px 24px rgba(21,101,192,0.35)" }}>
                📅 Prendre un rendez-vous
              </button>
              <button onClick={() => scrollTo("services")} style={{ ...style.btn, background: COLORS.white, color: COLORS.primary, border: `2px solid ${COLORS.primary}`, fontSize: "15px", padding: "14px 28px" }}>
                🔍 Nos services
              </button>
            </div>
            <div className="hero-stats" style={{ display: "flex", gap: "36px", marginTop: "44px" }}>
              {[["98%", "Satisfaction"], ["10K+", "Patients"], ["50+", "Experts"]].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontSize: "30px", fontWeight: "900", color: COLORS.primary }}>{v}</div>
                  <div style={{ fontSize: "13px", color: COLORS.gray600, fontWeight: "500" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-image" style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <div className="hero-image-card" style={{ width: "420px", height: "460px", borderRadius: "30px", overflow: "hidden", boxShadow: "0 30px 80px rgba(21,101,192,0.22)", position: "relative" }}>
              <img src={IMG.heroDoc} alt="Médecin professionnel" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(21,101,192,0.5) 0%, transparent 60%)" }} />
              <div style={{ position: "absolute", bottom: "20px", left: "20px", right: "20px" }}>
                <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: "14px", padding: "14px 18px", backdropFilter: "blur(10px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <img src={IMG.doc1} alt="" style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }} />
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: COLORS.gray900 }}>Dr. Sarah Benali</div>
                      <div style={{ fontSize: "12px", color: COLORS.primary }}>Cardiologue · Disponible aujourd'hui</div>
                    </div>
                    <div style={{ marginLeft: "auto", background: "#E8F5E9", color: "#00897B", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "20px" }}>✅ En ligne</div>
                  </div>
                </div>
              </div>
            </div>
            {[
              { top: "20px", left: "-20px", icon: "❤️", text: "Cardiologie", sub: "15 spécialistes" },
              { top: "160px", right: "-30px", icon: "⭐", text: "4.9 / 5", sub: "2 800 avis" },
              { bottom: "100px", left: "-30px", icon: "📅", text: "Rendez-vous", sub: "En ligne 24h/24" },
            ].map((c, i) => (
              <div key={i} className="hero-floating" style={{ position: "absolute", top: c.top, bottom: c.bottom, left: c.left, right: c.right, background: COLORS.white, borderRadius: "14px", padding: "10px 14px", boxShadow: "0 8px 28px rgba(21,101,192,0.14)", display: "flex", alignItems: "center", gap: "10px", minWidth: "150px" }}>
                <span style={{ fontSize: "26px" }}>{c.icon}</span>
                <div><div style={{ fontWeight: "700", fontSize: "13px", color: COLORS.gray900 }}>{c.text}</div><div style={{ fontSize: "11px", color: COLORS.gray600 }}>{c.sub}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="stats-section" style={{ background: COLORS.primary, padding: "60px 24px" }}>
        <div className="stats-grid" style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "24px" }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "16px" }}>
              <div style={{ fontSize: "42px", marginBottom: "10px" }}>{s.icon}</div>
              <div style={{ fontSize: "38px", fontWeight: "900", color: COLORS.white }}>{s.value}</div>
              <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section id="à-propos" className="about-section" style={{ padding: "100px 24px", background: COLORS.white }}>
        <div className="about-grid" style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "72px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <img src={IMG.clinic1} alt="Clinique intérieur" style={{ width: "100%", height: "420px", objectFit: "cover", borderRadius: "24px", boxShadow: "0 20px 60px rgba(21,101,192,0.16)" }} />
            <img src={IMG.about} alt="Bloc opératoire" style={{ position: "absolute", bottom: "-30px", right: "-30px", width: "200px", height: "160px", objectFit: "cover", borderRadius: "16px", border: "4px solid white", boxShadow: "0 10px 32px rgba(0,0,0,0.15)" }} />
            <div style={{ position: "absolute", top: "20px", left: "20px", background: COLORS.primary, color: COLORS.white, borderRadius: "12px", padding: "12px 18px", fontWeight: "800", fontSize: "14px", boxShadow: "0 4px 16px rgba(21,101,192,0.4)" }}>
              🏆 Fondée en 2002<br /><span style={{ fontWeight: "400", fontSize: "12px" }}>24 ans d'excellence</span>
            </div>
          </div>
          <div>
            <span style={style.badge}>🏥 À propos de nous</span>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,40px)", fontWeight: "800", color: COLORS.gray900, lineHeight: "1.2", marginBottom: "20px" }}>
              Une clinique de référence depuis 2002
            </h2>
            <p style={{ color: COLORS.gray600, fontSize: "16px", lineHeight: "1.9", marginBottom: "28px" }}>
              La Clinique Canadienne de Souanké est une clinique médicale pluridisciplinaire engagée à offrir des soins de santé de haute qualité. Dotée d'équipements de dernière génération et d'une équipe médicale expérimentée, nous accompagnons nos patients à chaque étape de leur parcours de santé.
            </p>
            <div className="about-features" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {["Soins personnalisés", "Technologie avancée", "Équipe multidisciplinaire", "Suivi numérique 360°"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", background: COLORS.accent, padding: "12px 14px", borderRadius: "10px" }}>
                  <span style={{ color: COLORS.primary, fontWeight: "700" }}>✓</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: COLORS.gray700 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES ─── */}
      <section id="services" className="services-section" style={{ padding: "100px 24px", background: COLORS.gray50 }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>🏥 Nos Services</span>
            <h2 style={style.sectionTitle}>Des soins complets pour toute la famille</h2>
            <p style={style.sectionSub}>Une gamme étendue de services médicaux pour répondre à tous vos besoins de santé.</p>
          </div>
          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "22px" }}>
            {services.map((s, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(`srv-${i}`)}
                onMouseLeave={() => setHovered(null)}
                style={{ ...style.card, transform: hovered === `srv-${i}` ? "translateY(-7px)" : "none", boxShadow: hovered === `srv-${i}` ? "0 20px 48px rgba(21,101,192,0.18)" : style.card.boxShadow, cursor: "pointer" }}>
                <div style={{ position: "relative", height: "170px", overflow: "hidden" }}>
                  <img src={s.img} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s" }}
                    onMouseEnter={e => e.target.style.transform = "scale(1.07)"}
                    onMouseLeave={e => e.target.style.transform = "scale(1)"} />
                  <div style={{ position: "absolute", inset: 0, background: hovered === `srv-${i}` ? "rgba(21,101,192,0.55)" : "rgba(0,0,0,0.18)", transition: "background 0.3s" }} />
                  <span style={{ position: "absolute", top: "12px", left: "12px", fontSize: "28px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>{s.icon}</span>
                </div>
                <div style={{ padding: "20px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: COLORS.gray900, marginBottom: "8px" }}>{s.title}</h3>
                  <p style={{ fontSize: "13px", color: COLORS.gray600, lineHeight: "1.6", marginBottom: "16px" }}>{s.desc}</p>
                  <button style={{ ...style.btn, background: COLORS.accent, color: COLORS.primary, border: "none", padding: "7px 16px", fontSize: "13px" }}>Voir plus →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY US ─── */}
      <section className="why-section" style={{ padding: "100px 24px", background: COLORS.white }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>💡 Pourquoi nous choisir ?</span>
            <h2 style={style.sectionTitle}>L'excellence médicale à votre service</h2>
            <p style={style.sectionSub}>Expertise humaine et technologies de pointe pour vous offrir les meilleurs soins.</p>
          </div>
          <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "24px" }}>
            {whyUs.map((item, i) => (
              <div key={i} style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 24px rgba(21,101,192,0.08)", border: "1px solid #EFF6FF", background: COLORS.white }}>
                <div style={{ height: "200px", position: "relative", overflow: "hidden" }}>
                  <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(21,101,192,0.1), rgba(21,101,192,0.6))" }} />
                  <span style={{ position: "absolute", bottom: "12px", left: "16px", fontSize: "32px" }}>{item.icon}</span>
                </div>
                <div style={{ padding: "20px" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: "700", color: COLORS.gray900, marginBottom: "8px" }}>{item.title}</h3>
                  <p style={{ fontSize: "14px", color: COLORS.gray600, lineHeight: "1.7" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DOCTORS ─── */}
      <section id="médecins" className="doctors-section" style={{ padding: "100px 24px", background: COLORS.gray50 }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>👨‍⚕️ Notre équipe médicale</span>
            <h2 style={style.sectionTitle}>Des médecins experts et dévoués</h2>
            <p style={style.sectionSub}>Une équipe de spécialistes hautement qualifiés à votre service avec bienveillance.</p>
          </div>
          <div className="doctors-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "24px" }}>
            {doctors.map((doc, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(`doc-${i}`)}
                onMouseLeave={() => setHovered(null)}
                style={{ borderRadius: "20px", overflow: "hidden", boxShadow: hovered === `doc-${i}` ? "0 20px 50px rgba(21,101,192,0.18)" : "0 4px 20px rgba(21,101,192,0.08)", border: "1px solid #EFF6FF", background: COLORS.white, transition: "all 0.3s", transform: hovered === `doc-${i}` ? "translateY(-8px)" : "none", cursor: "pointer" }}>
                <div style={{ position: "relative", height: "260px", overflow: "hidden" }}>
                  <img src={doc.img} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", transition: "transform 0.4s", transform: hovered === `doc-${i}` ? "scale(1.05)" : "scale(1)" }} />
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 50%, ${doc.color}CC 100%)` }} />
                  <div style={{ position: "absolute", bottom: "12px", left: "16px", right: "16px" }}>
                    <div style={{ color: COLORS.white, fontWeight: "800", fontSize: "16px" }}>{doc.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px" }}>{doc.specialty}</div>
                  </div>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: COLORS.gray600 }}>{doc.exp}</div>
                    <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>{"⭐⭐⭐⭐⭐".split("").map((s, j) => <span key={j} style={{ fontSize: "12px" }}>{s}</span>)}</div>
                  </div>
                  <button style={{ ...style.btn, background: COLORS.accent, color: COLORS.primary, border: "none", padding: "7px 14px", fontSize: "12px" }}>Profil</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEPARTMENTS ─── */}
      <section id="départements" className="departments-section" style={{ padding: "100px 24px", background: COLORS.white }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>🏢 Nos Départements</span>
            <h2 style={style.sectionTitle}>Spécialités médicales disponibles</h2>
            <p style={style.sectionSub}>Tous nos départements pour un suivi médical complet.</p>
          </div>
          <div className="departments-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "18px" }}>
            {departments.map((dept, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(`dep-${i}`)}
                onMouseLeave={() => setHovered(null)}
                style={{ borderRadius: "16px", overflow: "hidden", cursor: "pointer", boxShadow: "0 4px 20px rgba(21,101,192,0.08)", transition: "all 0.3s", transform: hovered === `dep-${i}` ? "translateY(-5px)" : "none" }}>
                <div style={{ position: "relative", height: "140px" }}>
                  <img src={dept.img} alt={dept.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: hovered === `dep-${i}` ? "rgba(21,101,192,0.72)" : "rgba(0,0,0,0.35)", transition: "background 0.3s" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span style={{ fontSize: "32px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>{dept.icon}</span>
                    <span style={{ color: COLORS.white, fontWeight: "700", fontSize: "14px", textShadow: "0 1px 4px rgba(0,0,0,0.5)", textAlign: "center", padding: "0 8px" }}>{dept.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="steps-section" style={{ padding: "100px 24px", background: "linear-gradient(135deg,#EFF6FF,#E8F5E9)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>⚙️ Comment ça fonctionne ?</span>
            <h2 style={style.sectionTitle}>Simple, rapide et sécurisé</h2>
            <p style={style.sectionSub}>5 étapes pour prendre soin de votre santé depuis chez vous.</p>
          </div>
          <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "20px" }}>
            {steps.map((step, i) => (
              <div key={i} style={{ background: COLORS.white, borderRadius: "20px", padding: "28px 20px", textAlign: "center", boxShadow: "0 4px 20px rgba(21,101,192,0.08)", border: "1px solid #EFF6FF" }}>
                <div style={{ width: "52px", height: "52px", background: COLORS.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: COLORS.white, fontWeight: "800", fontSize: "18px" }}>{step.num}</div>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>{step.icon}</div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: COLORS.gray900, marginBottom: "8px" }}>{step.title}</h3>
                <p style={{ fontSize: "12px", color: COLORS.gray600, lineHeight: "1.7" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="testimonials-section" style={{ padding: "100px 24px", background: COLORS.primary, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "100%", backgroundImage: `url(${IMG.clinic2})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.06 }} />
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center", position: "relative" }}>
          <span style={{ ...style.badge, background: "rgba(255,255,255,0.18)", color: COLORS.white }}>💬 Témoignages patients</span>
          <h2 style={{ ...style.sectionTitle, color: COLORS.white }}>Ce que disent nos patients</h2>
          <div style={{ minHeight: "260px" }}>
            {testimonials.map((t, i) => (
              <div key={i} className="testimonial-card" style={{ display: i === activeTestimonial ? "block" : "none", background: "rgba(255,255,255,0.12)", borderRadius: "24px", padding: "44px 48px", border: "1px solid rgba(255,255,255,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                  {"⭐".repeat(t.stars).split("").map((s, j) => <span key={j} style={{ fontSize: "22px" }}>{s}</span>)}
                </div>
                <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.95)", lineHeight: "1.85", fontStyle: "italic", marginBottom: "28px" }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" }}>
                  <img src={t.img} alt={t.name} style={{ width: "52px", height: "52px", borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,0.5)" }} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ color: COLORS.white, fontWeight: "700", fontSize: "16px" }}>{t.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "28px" }}>
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => { setActiveTestimonial(i); clearInterval(intervalRef.current); }} style={{ width: i === activeTestimonial ? "30px" : "10px", height: "10px", borderRadius: "5px", border: "none", background: i === activeTestimonial ? COLORS.white : "rgba(255,255,255,0.38)", cursor: "pointer", transition: "all 0.3s" }} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── NEWS ─── */}
      <section id="actualités" className="news-section" style={{ padding: "100px 24px", background: COLORS.gray50 }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>📰 Actualités & Santé</span>
            <h2 style={style.sectionTitle}>Conseils santé & actualités</h2>
            <p style={style.sectionSub}>Restez informés des dernières nouvelles et conseils de nos experts médicaux.</p>
          </div>
          <div className="news-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "24px" }}>
            {articles.map((a, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(`art-${i}`)}
                onMouseLeave={() => setHovered(null)}
                style={{ ...style.card, transform: hovered === `art-${i}` ? "translateY(-5px)" : "none", boxShadow: hovered === `art-${i}` ? "0 16px 40px rgba(21,101,192,0.16)" : style.card.boxShadow, cursor: "pointer" }}>
                <div style={{ position: "relative", height: "210px", overflow: "hidden" }}>
                  <img src={a.img} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s", transform: hovered === `art-${i}` ? "scale(1.06)" : "scale(1)" }} />
                  <div style={{ position: "absolute", top: "12px", left: "12px", background: COLORS.primary, color: COLORS.white, fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "20px" }}>{a.category}</div>
                </div>
                <div style={{ padding: "22px" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: "700", color: COLORS.gray900, lineHeight: "1.4", marginBottom: "14px" }}>{a.title}</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                    <span style={{ fontSize: "12px", color: COLORS.gray600 }}>📅 {a.date}</span>
                    <span style={{ fontSize: "12px", color: COLORS.gray600 }}>⏱ {a.readTime}</span>
                  </div>
                  <button style={{ ...style.btn, background: "transparent", color: COLORS.primary, border: `1.5px solid ${COLORS.primary}`, padding: "7px 18px", fontSize: "13px" }}>Lire l'article →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MOBILE APP ─── */}
      <section className="app-section" style={{ padding: "100px 24px", background: `linear-gradient(135deg,${COLORS.primaryDark},${COLORS.secondary})`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "40%", backgroundImage: `url(${IMG.mobile})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.15 }} />
        <div className="app-grid" style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center", position: "relative" }}>
          <div>
            <span style={{ ...style.badge, background: "rgba(255,255,255,0.18)", color: COLORS.white }}>📱 Application Mobile</span>
            <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: "800", color: COLORS.white, lineHeight: "1.2", marginBottom: "20px" }}>Votre santé dans votre poche</h2>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px", lineHeight: "1.8", marginBottom: "28px" }}>Gérez vos rendez-vous, consultez vos résultats et communiquez avec votre médecin depuis votre smartphone.</p>
            <div className="app-features" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
              {["📅 Rendez-vous en ligne", "📋 Résultats d'analyses", "🔔 Notifications médicales", "💬 Messagerie sécurisée"].map(f => (
                <div key={f} style={{ background: "rgba(255,255,255,0.14)", borderRadius: "12px", padding: "13px 16px", color: COLORS.white, fontSize: "14px", fontWeight: "500", border: "1px solid rgba(255,255,255,0.18)" }}>{f}</div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "14px" }}>
              <button style={{ ...style.btn, background: COLORS.white, color: COLORS.primaryDark, padding: "12px 26px", fontSize: "14px", fontWeight: "700" }}>🍎 App Store</button>
              <button style={{ ...style.btn, background: "rgba(255,255,255,0.18)", color: COLORS.white, border: "1.5px solid rgba(255,255,255,0.4)", padding: "12px 26px", fontSize: "14px" }}>🤖 Google Play</button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: "260px", height: "500px", background: "rgba(255,255,255,0.12)", borderRadius: "36px", border: "2px solid rgba(255,255,255,0.3)", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.3)" }}>
                <img src={IMG.mobile} alt="Application mobile Clinique Canadienne" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "34px" }} />
              </div>
              <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", width: "80px", height: "6px", background: "rgba(255,255,255,0.4)", borderRadius: "3px" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── LOCATION ─── */}
      <section className="location-section" style={{ padding: "100px 24px", background: COLORS.white }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>📍 Localisation</span>
            <h2 style={style.sectionTitle}>Nous trouver facilement</h2>
            <p style={style.sectionSub}>Situés au cœur de la ville, facilement accessibles en transport et en voiture.</p>
          </div>
          <div className="location-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
            <div style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 8px 32px rgba(21,101,192,0.12)", position: "relative" }}>
              <img src={IMG.clinic1} alt="Clinique extérieur" style={{ width: "100%", height: "380px", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(21,101,192,0.8) 100%)" }} />
              <div style={{ position: "absolute", bottom: "20px", left: "24px", right: "24px" }}>
                <div style={{ color: COLORS.white, fontWeight: "800", fontSize: "20px" }}>Clinique Canadienne de Souanké</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", marginTop: "4px" }}>📍 123 Avenue de la Médecine, Tunis</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { icon: "📍", label: "Adresse", value: "123 Avenue de la Médecine, 1002 Tunis, Tunisie" },
                { icon: "📞", label: "Téléphone", value: "+216 70 000 000" },
                { icon: "🚨", label: "Urgences 24h/24", value: "+216 70 111 111" },
                { icon: "📧", label: "Email", value: "contact@medicare-clinique.tn" },
                { icon: "🕐", label: "Horaires", value: "Lun–Sam : 08h00 – 20h00" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "16px 20px", background: COLORS.gray50, borderRadius: "14px", border: "1px solid #EFF6FF" }}>
                  <div style={{ width: "44px", height: "44px", background: COLORS.accent, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: COLORS.primary, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "3px" }}>{item.label}</div>
                    <div style={{ fontSize: "15px", color: COLORS.gray700, fontWeight: "500" }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section id="contact" className="contact-section" style={{ padding: "100px 24px", background: COLORS.gray50 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center" }}>
            <span style={style.badge}>✉️ Contactez-nous</span>
            <h2 style={style.sectionTitle}>Nous sommes à votre écoute</h2>
            <p style={style.sectionSub}>Notre équipe répond à toutes vos questions dans les plus brefs délais.</p>
          </div>
          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "40px", alignItems: "start" }}>
            <div className="contact-card" style={{ borderRadius: "20px", overflow: "hidden", boxShadow: "0 8px 32px rgba(21,101,192,0.12)" }}>
              <img src={IMG.about} alt="Équipe médicale" style={{ width: "100%", height: "300px", objectFit: "cover" }} />
              <div style={{ background: COLORS.primary, padding: "24px" }}>
                <div style={{ color: COLORS.white, fontWeight: "800", fontSize: "18px", marginBottom: "8px" }}>Une question ? Un rendez-vous ?</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: "1.7" }}>Notre équipe d'accueil est disponible du lundi au samedi de 08h à 20h pour vous aider.</div>
              </div>
            </div>
            <div className="contact-form" style={{ background: COLORS.white, borderRadius: "20px", padding: "40px", boxShadow: "0 4px 24px rgba(21,101,192,0.08)", border: "1px solid #EFF6FF" }}>
              <div className="contact-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                {[{ field: "nom", label: "Nom complet", placeholder: "Votre nom" }, { field: "tel", label: "Téléphone", placeholder: "+216 XX XXX XXX" }, { field: "email", label: "Email", placeholder: "votre@email.com" }, { field: "sujet", label: "Sujet", placeholder: "Objet de votre message" }].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.gray700, display: "block", marginBottom: "6px" }}>{label}</label>
                    <input type={field === "email" ? "email" : field === "tel" ? "tel" : "text"} placeholder={placeholder} value={formData[field]} onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #DBEAFE", fontSize: "14px", outline: "none", background: COLORS.white, boxSizing: "border-box", color: COLORS.gray900 }}
                      onFocus={e => e.target.style.borderColor = COLORS.primary}
                      onBlur={e => e.target.style.borderColor = "#DBEAFE"} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "18px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: COLORS.gray700, display: "block", marginBottom: "6px" }}>Message</label>
                <textarea placeholder="Décrivez votre demande en détail..." value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} rows={5}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #DBEAFE", fontSize: "14px", outline: "none", background: COLORS.white, resize: "vertical", boxSizing: "border-box", color: COLORS.gray900, fontFamily: "inherit" }}
                  onFocus={e => e.target.style.borderColor = COLORS.primary}
                  onBlur={e => e.target.style.borderColor = "#DBEAFE"} />
              </div>
              <button style={{ ...style.btn, background: COLORS.primary, color: COLORS.white, fontSize: "15px", padding: "13px 36px", marginTop: "22px", boxShadow: "0 6px 20px rgba(21,101,192,0.35)" }}>
                ✉️ Envoyer le message
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── IA INTÉGRÉE ─── */}
      <section className="ai-section" style={{ padding: "72px 24px", background: "linear-gradient(135deg, #0B1F3A 0%, #123C73 55%, #0F766E 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${IMG.clinic2})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.08 }} />
        <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative" }}>
          <div className="section-intro" style={{ textAlign: "center" }}>
            <span className="animate-pop-in" style={{ ...style.badge, background: "rgba(255,255,255,0.14)", color: COLORS.white }}>🤖 Intelligence artificielle intégrée</span>
            <h2 className="animate-fade-up" style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: "800", color: COLORS.white, lineHeight: "1.15", marginBottom: "16px" }}>
              Une IA au service de vos équipes et de vos patients
            </h2>
            <p className="animate-fade-up delay-1" style={{ maxWidth: "760px", margin: "0 auto 34px", color: "rgba(255,255,255,0.82)", fontSize: "16px", lineHeight: "1.8" }}>
              Assistance clinique, orientation rapide, synthèse des données et aide à la décision: l’IA s’intègre dans le système pour accélérer les tâches sans remplacer le jugement médical.
            </p>
          </div>

          <div className="ai-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gap: "18px", alignItems: "stretch" }}>
            <div className="ai-main-card animate-zoom-in" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "24px", padding: "28px", backdropFilter: "blur(10px)", boxShadow: "0 20px 60px rgba(0,0,0,0.16)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>🤖</div>
                <div>
                  <div style={{ color: COLORS.white, fontWeight: "800", fontSize: "18px" }}>Assistant IA Clinique</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>Disponible pour le personnel et le portail patient</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: "12px", marginBottom: "22px" }}>
                {[
                  "Analyse rapide des symptômes et orientation",
                  "Résumé intelligent des dossiers patients",
                  "Aide à la rédaction des comptes rendus",
                  "Alertes sur les valeurs critiques",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", gap: "10px", alignItems: "flex-start", color: COLORS.white, fontSize: "14px", lineHeight: "1.6" }}>
                    <span style={{ color: "#7DD3FC", fontWeight: "800" }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Link to="/ai" style={{ ...style.btn, background: COLORS.white, color: COLORS.primaryDark, padding: "12px 20px", fontWeight: "800" }}>
                  Ouvrir l’espace IA
                </Link>
                <button onClick={() => scrollTo("contact")} style={{ ...style.btn, background: "rgba(255,255,255,0.12)", color: COLORS.white, border: "1px solid rgba(255,255,255,0.22)", padding: "12px 20px" }}>
                  Demander une démo
                </button>
              </div>
            </div>

            {[
              { title: "Triage intelligent", text: "Priorise les demandes urgentes et suggère le bon service en quelques secondes.", icon: "🧭" },
              { title: "Synthèse patient", text: "Résume les antécédents, traitements et événements clés pour gagner du temps.", icon: "📄" },
              { title: "Support clinique", text: "Aide les équipes à comparer, rechercher et retrouver les informations utiles.", icon: "🩺" },
            ].map((item) => (
              <div key={item.title} className="ai-feature-card animate-fade-up" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "24px", padding: "24px", color: COLORS.white, backdropFilter: "blur(10px)" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "16px", background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", marginBottom: "18px" }}>{item.icon}</div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "10px" }}>{item.title}</h3>
                <p style={{ fontSize: "14px", lineHeight: "1.8", color: "rgba(255,255,255,0.8)" }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer-section" style={{ background: COLORS.gray900, color: "rgba(255,255,255,0.7)", padding: "70px 24px 0" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", gap: "48px", paddingBottom: "56px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                <div style={{ width: "44px", height: "44px", background: `linear-gradient(135deg,${COLORS.primary},${COLORS.secondary})`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>🏥</div>
                <div>
                  <div style={{ fontWeight: "800", fontSize: "18px", color: COLORS.white }}>Clinique Canadienne</div>
                  <div style={{ fontSize: "12px", color: COLORS.secondary }}>de Souanké</div>
                </div>
              </div>
              <p style={{ fontSize: "14px", lineHeight: "1.85", maxWidth: "290px", marginBottom: "22px" }}>
                Une clinique de référence offrant des soins de qualité supérieure dans un environnement moderne et bienveillant depuis 2002.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                {["📘", "🐦", "📸", "💼"].map((icon, i) => (
                  <div key={i} style={{ width: "38px", height: "38px", background: "rgba(255,255,255,0.1)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "17px", transition: "background 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.22)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}>{icon}</div>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ color: COLORS.white, fontWeight: "700", marginBottom: "18px", fontSize: "15px" }}>Services</h4>
              {["Consultation", "Pédiatrie", "Maternité", "Chirurgie", "Urgences", "Laboratoire"].map(s => (
                <div key={s} style={{ marginBottom: "10px", fontSize: "14px", cursor: "pointer", transition: "color 0.2s" }}
                  onMouseEnter={e => e.target.style.color = COLORS.white}
                  onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.7)"}>{s}</div>
              ))}
            </div>
            <div>
              <h4 style={{ color: COLORS.white, fontWeight: "700", marginBottom: "18px", fontSize: "15px" }}>Liens utiles</h4>
              {["À propos", "Médecins", "Actualités", "Carrières", "FAQ", "Urgences"].map(l => (
                <div key={l} style={{ marginBottom: "10px", fontSize: "14px", cursor: "pointer", transition: "color 0.2s" }}
                  onMouseEnter={e => e.target.style.color = COLORS.white}
                  onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.7)"}>{l}</div>
              ))}
            </div>
            <div>
              <h4 style={{ color: COLORS.white, fontWeight: "700", marginBottom: "18px", fontSize: "15px" }}>Contact</h4>
              {[
                { icon: "📍", text: "123 Avenue de la Médecine, 1002 Tunis" },
                { icon: "📞", text: "+216 70 000 000" },
                { icon: "🚨", text: "Urgences : +216 70 111 111" },
                { icon: "📧", text: "contact@medicare.tn" },
                { icon: "🕐", text: "Lun–Sam : 08h00 – 20h00" },
              ].map(item => (
                <div key={item.text} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "12px", fontSize: "13px", lineHeight: "1.5" }}>
                  <span style={{ minWidth: "18px" }}>{item.icon}</span><span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", padding: "22px 24px" }}>
          <div className="footer-bottom" style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <span style={{ fontSize: "13px" }}>© 2026 Clinique Canadienne de Souanké. Tous droits réservés.</span>
            <div style={{ display: "flex", gap: "24px" }}>
              {["Politique de confidentialité", "Conditions d'utilisation", "Plan du site"].map(l => (
                <span key={l} style={{ fontSize: "13px", cursor: "pointer", transition: "color 0.2s" }}
                  onMouseEnter={e => e.target.style.color = COLORS.white}
                  onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.7)"}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        *{box-sizing:border-box;margin:0;padding:0}
        button,input,textarea,select{font-family:inherit}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-thumb{background:#1565C0;border-radius:3px}

        .hero-copy > span{animation:popIn .5s ease both}
        .hero-copy h1{animation:fadeUp .7s ease both .06s}
        .hero-copy p{animation:fadeUp .7s ease both .16s}
        .hero-actions{animation:fadeUp .7s ease both .24s}
        .hero-stats{animation:fadeUp .7s ease both .32s}
        .hero-image-card{animation:zoomIn .8s ease both, float 7s ease-in-out infinite .8s}

        .services-section > div > div:first-child,
        .why-section > div > div:first-child,
        .doctors-section > div > div:first-child,
        .departments-section > div > div:first-child,
        .steps-section > div > div:first-child,
        .news-section > div > div:first-child,
        .location-section > div > div:first-child,
        .contact-section > div > div:first-child,
        .app-section > div > div:first-child,
        .testimonials-section > div > div:first-child{
          animation:fadeUp .7s ease both;
        }

        .services-grid > div,
        .why-grid > div,
        .doctors-grid > div,
        .departments-grid > div,
        .steps-grid > div,
        .news-grid > div,
        .contact-card,
        .contact-form,
        .footer-grid > div,
        .location-grid > div{
          animation:fadeUp .75s ease both;
        }

        .services-grid > div:nth-child(2),
        .why-grid > div:nth-child(2),
        .doctors-grid > div:nth-child(2),
        .departments-grid > div:nth-child(2),
        .steps-grid > div:nth-child(2),
        .news-grid > div:nth-child(2){animation-delay:.08s}
        .services-grid > div:nth-child(3),
        .why-grid > div:nth-child(3),
        .doctors-grid > div:nth-child(3),
        .departments-grid > div:nth-child(3),
        .steps-grid > div:nth-child(3),
        .news-grid > div:nth-child(3){animation-delay:.16s}
        .services-grid > div:nth-child(4),
        .why-grid > div:nth-child(4),
        .doctors-grid > div:nth-child(4),
        .departments-grid > div:nth-child(4),
        .steps-grid > div:nth-child(4),
        .news-grid > div:nth-child(4){animation-delay:.24s}

        .services-grid > div:hover,
        .why-grid > div:hover,
        .doctors-grid > div:hover,
        .departments-grid > div:hover,
        .steps-grid > div:hover,
        .news-grid > div:hover,
        .contact-card:hover,
        .contact-form:hover{
          transform:translateY(-6px);
          transition:transform .25s ease, box-shadow .25s ease;
        }

        @media(min-width:1024px){
          .mobile-menu-toggle,
          .mobile-menu-panel{
            display:none!important;
          }

          .about-section,
          .services-section,
          .why-section,
          .doctors-section,
          .departments-section,
          .steps-section,
          .testimonials-section,
          .news-section,
          .app-section,
          .location-section,
          .contact-section,
          .footer-section{
            padding-top:72px!important;
            padding-bottom:72px!important;
          }

          .stats-section{
            padding-top:44px!important;
            padding-bottom:44px!important;
          }
        }
        @media(max-width:768px){
          .hero-section{
            padding-top:76px!important;
            padding-bottom:28px!important;
          }

          .stats-section,
          .stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important}
          .stats-grid > div{padding:10px 8px!important}
          .stats-grid > div > div:first-child{font-size:28px!important}
          .stats-grid > div > div:nth-child(2){font-size:24px!important}

          .about-grid,
          .app-grid,
          .ai-grid,
          .location-grid,
          .contact-grid,
          .footer-grid{
            grid-template-columns:1fr!important;
            gap:24px!important;
          }

          .about-section,
          .services-section,
          .why-section,
          .doctors-section,
          .departments-section,
          .steps-section,
          .testimonials-section,
          .news-section,
          .app-section,
          .location-section,
          .contact-section,
          .footer-section{
            padding-top:52px!important;
            padding-bottom:52px!important;
            padding-left:18px!important;
            padding-right:18px!important;
          }

          .stats-section{
            padding-top:36px!important;
            padding-bottom:36px!important;
          }

          .footer-section{
            padding-top:44px!important;
            padding-bottom:0!important;
          }

          .ai-section{
            padding-top:52px!important;
            padding-bottom:52px!important;
            padding-left:18px!important;
            padding-right:18px!important;
          }

          .about-features,
          .app-features,
          .contact-form-grid{
            grid-template-columns:1fr!important;
          }

          .ai-main-card,
          .ai-feature-card{
            padding:22px!important;
            border-radius:20px!important;
          }

          .about-section > div,
          .location-section > div,
          .contact-section > div,
          .services-section > div,
          .why-section > div,
          .doctors-section > div,
          .departments-section > div,
          .steps-section > div,
          .testimonials-section > div,
          .news-section > div{
            width:100%!important;
          }

          .about-section img[alt="Clinique intérieur"],
          .location-section img[alt="Clinique extérieur"],
          .contact-card img,
          .doctors-section .hero-floating,
          .hero-floating{
            max-width:100%!important;
          }

          .about-section img[alt="Bloc opératoire"]{
            width:140px!important;
            height:110px!important;
            bottom:-14px!important;
            right:-10px!important;
          }

          .about-section img[alt="Clinique intérieur"],
          .location-section img[alt="Clinique extérieur"],
          .contact-card img{
            height:auto!important;
            min-height:220px!important;
          }

          .services-grid,
          .why-grid,
          .doctors-grid,
          .departments-grid,
          .steps-grid,
          .news-grid{
            grid-template-columns:1fr!important;
          }

          .news-grid{
            gap:18px!important;
          }

          .testimonial-card{
            padding:28px 20px!important;
          }

          .app-grid > div:last-child{
            order:-1;
          }

          .app-grid .app-features{
            margin-bottom:20px!important;
          }

          .footer-bottom{
            flex-direction:column!important;
            align-items:flex-start!important;
          }

          .footer-bottom > div{
            flex-wrap:wrap!important;
            gap:12px!important;
          }

          .hero-image-card,
          .services-grid > div,
          .why-grid > div,
          .doctors-grid > div,
          .departments-grid > div,
          .steps-grid > div,
          .news-grid > div,
          .contact-card,
          .contact-form,
          .footer-grid > div,
          .location-grid > div{
            animation-duration:.01ms!important;
            animation-iteration-count:1!important;
          }
        }

        @media (prefers-reduced-motion: reduce){
          *{
            animation:none!important;
            scroll-behavior:auto!important;
            transition:none!important;
          }
        }
      `}</style>
    </div>
  );
}