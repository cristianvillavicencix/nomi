import {
  DEFAULT_CONTRACT_VARIABLES,
  MAINTENANCE_CONTRACT_VARIABLES,
  CONTRACT_ACCEPTANCE_SIGNATURE_HTML,
} from "@/modules/proposals/proposalCommercialConstants";

export const LBS_WEB_MAINTENANCE_CONTRACT_VERSION = "1.4";

export const LBS_WEB_MAINTENANCE_CONTRACT_TITLE =
  "Contrato de Mantenimiento y Soporte Web";

/**
 * Spanish legal body for recurring website maintenance subscriptions.
 * Same document style as the general LBS terms: flowing prose, numbered
 * sections, variables in-sentence — not form/table layouts.
 */
export const LBS_WEB_MAINTENANCE_CONTRACT_BODY = `# Contrato de Mantenimiento y Soporte Web — Latinos Business Support (LBS)

## 1. Partes del Acuerdo

Este Acuerdo de Mantenimiento y Soporte Web ("Acuerdo") se celebra entre **{{provider_name}}** ("LBS", representado(a) por **{{provider_representative}}**, "nosotros", "el Proveedor"), con domicilio en {{provider_address}}, y **{{client_name}}** ("el Cliente", "usted"), con domicilio en {{client_address}}, representado(a) por **{{client_representative}}**, con fecha de **{{contract_date}}**.

Suscripción: **{{subscription_name}}**{{subscription_number_line}}.
{{subscription_description_line}}
Este Acuerdo se basa en la suscripción / contrato N.º **{{subscription_number}}** aceptada por el Cliente el **{{accepted_at}}**, la cual se incorpora por referencia.

## 2. Objeto y alcance del servicio

LBS prestará servicios de mantenimiento, soporte técnico y actualización del sitio web del Cliente, conforme al plan descrito en la **Sección 15 (Anexo de Servicios)** y a las líneas siguientes:

{{line_items}}

**Los servicios pueden incluir, según el plan contratado:**
- Actualizaciones de contenido (texto, imágenes, enlaces).
- Actualizaciones de seguridad del CMS, plugins y temas.
- Respaldo (backup) regular de archivos y base de datos.
- Monitoreo de uptime y rendimiento.
- Corrección de errores técnicos menores.
- Soporte técnico vía correo electrónico / ticket / teléfono.
- Actualizaciones menores de diseño (CSS/HTML básico).
- Optimización de velocidad y SEO técnico básico.

**Queda excluido de este Acuerdo**, salvo acuerdo escrito distinto:
- Rediseño completo del sitio web.
- Desarrollo de nuevas funcionalidades o módulos complejos.
- Creación de nueva marca, logotipos o identidad visual.
- Marketing digital, gestión de redes sociales o campañas publicitarias.
- Servicios de hosting o registro de dominio.

## 3. Duración y renovación

**3.1.** Este Acuerdo tendrá una duración inicial de **{{initial_term_months}} meses**, contados desde la fecha de firma o del primer pago, lo que ocurra último.

**3.2. Renovación.** El Acuerdo se renovará automáticamente por períodos iguales, salvo que cualquiera de las partes notifique por escrito (correo electrónico o carta certificada) su intención de no renovar con al menos **{{cancel_notice_days}}** días naturales de anticipación al vencimiento del período en curso.

## 4. Compensación y pagos

**4.1.** El Cliente pagará a LBS la tarifa recurrente del Anexo: **{{recurring_terms}}** ({{total_amount}} {{currency}}).

**4.2. Fecha de pago.** Los pagos se realizarán por adelantado el día **{{billing_day}}** de cada período de facturación.

**4.3. Métodos de pago.** Tarjeta de crédito/débito, ACH, transferencia bancaria, PayPal, Zelle u otros acordados por escrito. El Cliente autoriza cargos automáticos recurrentes al método de pago registrado mientras el Acuerdo esté vigente.

**4.4. Pagos tardíos.** Los pagos recibidos después de **{{late_days}}** días de la fecha de vencimiento pueden generar un cargo por mora del **{{late_fee}}** (o el máximo permitido por la ley aplicable). LBS podrá suspender los servicios después de **{{late_suspension_days}}** días de retraso, previo aviso por escrito.

**4.5. Aumentos de tarifa.** LBS podrá incrementar las tarifas con un preaviso de **{{fee_increase_notice_days}}** días por escrito. Si el Cliente no acepta el nuevo precio, podrá terminar el Acuerdo sin penalización al final del período en curso.

## 5. Responsabilidades del Cliente

El Cliente se compromete a:
- Proporcionar acceso o credenciales necesarias (FTP, cPanel, CMS, hosting, dominio) y garantizar que tiene derecho legal a hacerlo.
- Responder a solicitudes de información o aprobación dentro de **{{client_response_days}}** días hábiles.
- Realizar copias de seguridad propias si así lo desea, aunque LBS ofrezca respaldos.
- No modificar el sitio de forma que interfiera con el trabajo de LBS sin notificación previa.
- Cumplir las leyes aplicables (propiedad intelectual, privacidad de datos como CCPA/GDPR si aplica, y regulaciones de la FTC).

## 6. Responsabilidades del Proveedor

LBS se compromete a:
- Prestar los servicios con la diligencia y cuidado razonable de un profesional de la industria.
- Responder a solicitudes de soporte dentro del tiempo del plan (**{{response_time}}**).
- Mantener la confidencialidad de la información del Cliente (Sección 9).
- Notificar al Cliente de problemas críticos de seguridad detectados.

**Limitación de responsabilidad.** LBS no será responsable por pérdida de ingresos, datos o beneficios del Cliente; fallas de terceros (hosting, plugins, ataques fuera del control razonable); ni daños indirectos, incidentales, especiales o consecuenciales. En ningún caso la responsabilidad total de LBS excederá el monto pagado por el Cliente en los **{{liability_cap_months}} meses** anteriores al evento que dio origen a la reclamación.

## 7. Propiedad intelectual

- El Cliente retiene todos los derechos sobre su sitio web, marca, contenido y materiales proporcionados.
- El código o soluciones originales desarrolladas específicamente para el Cliente por LBS durante la vigencia de este Acuerdo serán propiedad del Cliente una vez pagados los servicios correspondientes.
- LBS retiene derechos sobre herramientas, frameworks, plantillas y metodologías generales de su propiedad.

## 8. Terminación

**8.1. Con causa.** Cualquiera de las partes podrá terminar este Acuerdo de inmediato si la otra incumple sustancialmente y no corrige dentro de **{{cure_period_days}}** días tras notificación por escrito.

**8.2. Sin causa.** El Cliente podrá terminar en cualquier momento con **{{termination_notice_days}}** días de preaviso por escrito, quedando obligado al pago de los servicios prestados hasta la fecha de terminación. No hay reembolso de pagos adelantados salvo incumplimiento de LBS.

**8.3.** Al terminarse, LBS entregará al Cliente las credenciales y archivos actualizados del sitio dentro de **{{credential_handoff_days}}** días hábiles, siempre que no existan pagos pendientes.

## 9. Confidencialidad

Ambas partes mantendrán confidencial la información no pública, credenciales, datos de clientes y estrategias de negocio reveladas durante la relación. Esta obligación sobrevive a la terminación por **{{confidentiality_years}} años**.

## 10. Indemnización

Cada parte indemnizará y mantendrá indemne a la otra frente a reclamaciones, daños o gastos (incluyendo honorarios de abogados razonables) derivados de su propia negligencia, incumplimiento de este Acuerdo o violación de derechos de terceros.

## 11. Fuerza mayor

Ninguna de las partes será responsable por incumplimientos causados por eventos fuera de su control razonable, incluyendo desastres naturales, fallas regionales de internet, pandemias, huelgas o fallas de terceros (hosting, nube).

## 12. Ley aplicable y jurisdicción

Este Acuerdo se rige por las leyes del Estado de **{{governing_state}}**, sin efecto a conflictos de leyes. Es válido y ejecutable en cualquier estado de los Estados Unidos. Para jurisdicción, las partes se someten a los tribunales estatales y federales del condado de **{{jurisdiction_county}}**, Estado de **{{jurisdiction_state}}**.

Antes de litigio, las partes intentarán mediación no vinculante. Si falla, la controversia podrá resolverse por arbitraje vinculante bajo reglas de la AAA o en los tribunales de esta sección, a elección de la parte demandante.

## 13. Independencia contractual

LBS es un contratista independiente. Nada en este Acuerdo crea empleo, sociedad, franquicia o joint venture entre las partes.

## 14. Acuerdo completo y comunicaciones

Este Acuerdo, con sus anexos, constituye el acuerdo completo entre las partes y sustituye cualquier acuerdo previo. Las modificaciones solo serán válidas por escrito y firmadas (o confirmadas por correo) por ambas partes. Si alguna cláusula es inválida, las demás permanecen en vigor. La omisión de exigir un término no constituye renuncia a derechos futuros.

Las notificaciones serán válidas por correo electrónico a las direcciones indicadas arriba, o por correo certificado con acuse de recibo.

## 15. Anexo: plan de servicios contratado

| Característica | Plan seleccionado |
| --- | --- |
| Nombre del plan | {{subscription_name}} |
| Tarifa | {{total_amount}} |
| Horas incluidas | {{included_hours}} |
| Tiempo de respuesta | {{response_time}} |
| Backups | {{backup_frequency}} |
| Actualizaciones de seguridad | {{security_updates}} |
| Soporte vía | {{support_channels}} |
| Horario de soporte | {{support_hours}} |
| Alcance adicional | {{additional_scope}} |

## 16. Aceptación

Al firmar electrónicamente, marcar “Acepto” o completar el proceso de aceptación del portal, el Cliente declara haber leído y aceptado este Acuerdo.

${CONTRACT_ACCEPTANCE_SIGNATURE_HTML}

*Versión del documento: {{terms_version}} · {{provider_name}} · {{provider_address}}*`;

export const getWebMaintenanceContractTermsSeed = () => ({
  version: LBS_WEB_MAINTENANCE_CONTRACT_VERSION,
  title: LBS_WEB_MAINTENANCE_CONTRACT_TITLE,
  slug: "web-maintenance-support",
  body_markdown: LBS_WEB_MAINTENANCE_CONTRACT_BODY,
  default_variables: {
    ...DEFAULT_CONTRACT_VARIABLES,
    ...MAINTENANCE_CONTRACT_VARIABLES,
  },
  is_active: true,
});
