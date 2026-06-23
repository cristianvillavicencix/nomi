/**
 * Sample SMS shortcut templates for supplements / client intake workflows.
 * Body copy is Spanish (domain content); names/labels stay English in Settings.
 */
export type DefaultMessageShortcutSeed = {
  name: string;
  body: string;
  shortcut_label: string;
  tile_color: string;
  shortcut_sort_order: number;
  composer_shortcut: boolean;
  language: "en" | "es";
  variables: string[];
};

export const DEFAULT_MESSAGE_SHORTCUT_SAMPLES: DefaultMessageShortcutSeed[] = [
  {
    name: "Supplements intake",
    shortcut_label: "SUP",
    tile_color: "#0d9488",
    shortcut_sort_order: 0,
    composer_shortcut: true,
    language: "es",
    variables: ["contact_first_name"],
    body: `Hola {{contact_first_name}},

Para proceder con los suplementos necesitamos lo siguiente:

Medidas (si no las tienes, nosotros nos encargamos — tiene un costo extra)
Scope de seguro, si lo tienes
Fotos: pueden ser el link de CompanyCam o el que uses`,
  },
  {
    name: "Quick hello",
    shortcut_label: "HOL",
    tile_color: "#2563eb",
    shortcut_sort_order: 1,
    composer_shortcut: true,
    language: "es",
    variables: ["contact_first_name"],
    body: "Hola {{contact_first_name}}, ¿cómo estás?",
  },
  {
    name: "Follow up",
    shortcut_label: "FU",
    tile_color: "#7c3aed",
    shortcut_sort_order: 2,
    composer_shortcut: true,
    language: "es",
    variables: ["contact_first_name", "user_first_name", "org_name"],
    body: `Hola {{contact_first_name}}, soy {{user_first_name}} de {{org_name}}. Solo dando seguimiento — ¿tienes alguna pregunta?`,
  },
  {
    name: "Photos reminder",
    shortcut_label: "FOT",
    tile_color: "#ea580c",
    shortcut_sort_order: 3,
    composer_shortcut: true,
    language: "es",
    variables: ["contact_first_name"],
    body: `Hola {{contact_first_name}}, cuando puedas envíanos fotos del área de trabajo. Puedes usar CompanyCam o el link que prefieras.`,
  },
];

export const defaultMessageShortcutSeedKey = (name: string) =>
  `sample:${name.trim().toLowerCase()}`;
