import type { PortalLocale } from "@/modules/portal/portalI18n";

export type PortalHandoffExpectations = {
  lbsTitle: string;
  clientTitle: string;
  lbsItems: string[];
  clientItems: string[];
  footnote: string;
};

const expectations: Record<PortalLocale, PortalHandoffExpectations> = {
  es: {
    lbsTitle: "Lo que LBS te entrega aquí",
    clientTitle: "Lo que necesitas tener listo de tu lado",
    lbsItems: [
      "Accesos y contraseñas de tu sitio web (hosting, panel, CMS, FTP, etc.).",
      "Enlace para visitar tu sitio en vivo y staging cuando aplique.",
      "Este portal seguro para consultar credenciales cuando las necesites.",
    ],
    clientItems: [
      "Renovar hosting y dominio con tu proveedor a tiempo (LBS no administra tu dominio).",
      "Guardar estas contraseñas en un lugar seguro — idealmente un gestor de contraseñas.",
      "Mantener acceso a Google Business, redes y correo corporativo si tú los administras.",
      "Avisarnos por tu canal habitual de soporte si algo del sitio deja de funcionar.",
      "No compartir este enlace del portal con personas fuera de tu empresa.",
    ],
    footnote:
      "¿Falta un acceso o algo no coincide? Escríbenos por el mismo canal que usas con tu project manager.",
  },
  en: {
    lbsTitle: "What LBS provides in this portal",
    clientTitle: "What you need ready on your side",
    lbsItems: [
      "Website logins and passwords (hosting, control panel, CMS, FTP, etc.).",
      "Links to open your live site and staging when available.",
      "This secure portal to look up credentials whenever you need them.",
    ],
    clientItems: [
      "Renew hosting and domain with your provider on time (LBS does not manage your domain).",
      "Store these passwords somewhere safe — a password manager is best.",
      "Keep access to Google Business, social accounts, and corporate email if you manage them.",
      "Reach out through your usual support channel if something on the site stops working.",
      "Do not share this portal link with people outside your company.",
    ],
    footnote:
      "Missing an access or something looks wrong? Contact us through the same channel you use with your project manager.",
  },
};

export const getPortalHandoffExpectations = (locale: PortalLocale) =>
  expectations[locale];
