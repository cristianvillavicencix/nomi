import { DEFAULT_CONTRACT_VARIABLES } from "@/modules/proposals/proposalCommercialConstants";

export const WEB_MAINTENANCE_CONTRACT_SLUG = "web-maintenance";
export const WEB_MAINTENANCE_CONTRACT_VERSION = "1.0";

export const WEB_MAINTENANCE_CONTRACT_TITLE =
  "Acuerdo de Mantenimiento Web — Latinos Business Support (LBS)";

/** Spanish legal body for recurring web maintenance subscriptions. */
export const WEB_MAINTENANCE_CONTRACT_BODY = `# Acuerdo de Mantenimiento Web — Latinos Business Support (LBS)

## 1. Partes del Acuerdo

Este Acuerdo de Mantenimiento Web ("Acuerdo") se celebra entre **Latinos Business Support LLC** ("LBS", "nosotros", "el Proveedor"), con domicilio en Stamford, Connecticut, y **{{client_name}}** ("el Cliente", "usted"), con domicilio en {{client_address}}, con fecha de **{{contract_date}}**.

Suscripción: **{{subscription_name}}**{{subscription_number_line}}.

## 2. Alcance del servicio

LBS prestará el servicio de mantenimiento web recurrente detallado a continuación:

{{line_items}}

**Importe recurrente:** {{total_amount}} ({{recurring_terms}}).

Salvo acuerdo escrito distinto, el alcance típico de mantenimiento incluye:
- Actualizaciones de seguridad y de plataforma cuando apliquen al sitio del Cliente.
- Copias de seguridad periódicas según la política vigente de LBS.
- Monitoreo básico de disponibilidad y respuesta a incidencias reportadas.
- Hasta el tiempo de soporte incluido en el plan contratado para cambios menores de contenido.

Queda **fuera de alcance** (requiere cotización aparte): rediseños, desarrollos nuevos, migraciones mayores, campañas de marketing, SEO avanzado, o trabajo que exceda las horas del plan.

## 3. Responsabilidades del Cliente

El Cliente se compromite a:
- Facilitar accesos necesarios (hosting, CMS, DNS, analítica) de forma segura.
- Designar un contacto con autoridad para aprobar cambios.
- Responder a solicitudes de información dentro de **{{client_response_days}}** días hábiles.
- Garantizar que el contenido proporcionado no infringe derechos de terceros.

## 4. Facturación y renovación

- La suscripción se factura de forma **{{billing_interval}}** según el importe indicado.
- El cobro se realiza con el método de pago registrado por el Cliente.
- El Cliente puede cancelar con aviso de **{{cancel_notice_days}}** días según las condiciones del plan; los periodos ya facturados no son reembolsables salvo disposición legal aplicable.

## 5. Disponibilidad y soporte

LBS realizará esfuerzos comercialmente razonables para mantener el sitio operativo. El soporte se presta en horario laboral de LBS salvo que el plan indique cobertura ampliada. Incidentes críticos se priorizan según severidad.

## 6. Limitación de responsabilidad

En la máxima medida permitida por la ley, la responsabilidad agregada de LBS bajo este Acuerdo no excederá los honorarios de mantenimiento efectivamente pagados por el Cliente en los tres (3) meses anteriores al reclamo. LBS no responde por daños indirectos, lucro cesante ni interrupciones causadas por terceros (hosting, DNS, proveedores).

## 7. Confidencialidad y datos

Las partes tratarán como confidencial la información técnica y de negocio intercambiada. El tratamiento de datos personales se rige por la política de privacidad de LBS y la normativa aplicable.

## 8. Ley aplicable

Este Acuerdo se rige por las leyes del Estado de **Connecticut, EE. UU.**

## 9. Aceptación

Al firmar electrónicamente y agregar un método de pago, el Cliente declara haber leído y aceptado este Acuerdo.

**Cliente:** {{client_name}}
**Aceptado el:** {{signed_at}}
**Dirección IP:** {{signed_ip}}

*Versión del documento: {{terms_version}} · Latinos Business Support LLC · Stamford, CT*
`;

export const getWebMaintenanceContractTermsSeed = () => ({
  slug: WEB_MAINTENANCE_CONTRACT_SLUG,
  version: WEB_MAINTENANCE_CONTRACT_VERSION,
  title: WEB_MAINTENANCE_CONTRACT_TITLE,
  body_markdown: WEB_MAINTENANCE_CONTRACT_BODY,
  default_variables: {
    ...DEFAULT_CONTRACT_VARIABLES,
    cancel_notice_days: "30",
    client_response_days: "5",
  },
  is_active: true,
  is_default: false,
});
