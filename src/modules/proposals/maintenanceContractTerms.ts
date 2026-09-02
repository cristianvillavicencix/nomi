import {
  DEFAULT_CONTRACT_VARIABLES,
  MAINTENANCE_CONTRACT_VARIABLES,
} from "@/modules/proposals/proposalCommercialConstants";

export const LBS_WEB_MAINTENANCE_CONTRACT_VERSION = "1.0";

export const LBS_WEB_MAINTENANCE_CONTRACT_TITLE =
  "Contrato de Mantenimiento y Soporte Web";

/** Spanish legal body for recurring website maintenance subscriptions. */
export const LBS_WEB_MAINTENANCE_CONTRACT_BODY = `# CONTRATO DE MANTENIMIENTO Y SOPORTE WEB

**Fecha de efecto:** {{contract_date}}

**Número de contrato:** {{subscription_number}}

## PARTES

### PROVEEDOR

**{{provider_name}}**

- Sitio web: {{provider_website}}
- Dirección: {{provider_address}}
- Estado de incorporación: {{provider_incorporation_state}}
- EIN / Número de identificación fiscal: {{provider_ein}}
- Representante: {{provider_representative}}
- Correo electrónico: {{provider_email}}
- Teléfono: {{provider_phone}}

*(En adelante, "EL PROVEEDOR" o "LBS")*

### CLIENTE

- **Nombre / Empresa:** {{client_name}}
- **Dirección:** {{client_address}}
- **Ciudad, Estado, ZIP:** {{client_city_state_zip}}
- **Representante:** {{client_representative}}
- **Correo electrónico:** {{client_email}}
- **Teléfono:** {{client_phone}}

*(En adelante, "EL CLIENTE")*

---

## 1. OBJETO Y ALCANCE DEL SERVICIO

El PROVEEDOR se compromete a prestar servicios de mantenimiento, soporte técnico y actualización del sitio web propiedad del CLIENTE, de acuerdo con el plan seleccionado en la **Sección 15 (Anexo de Servicios)**.

Los servicios pueden incluir, según el plan contratado:

- Actualizaciones de contenido (texto, imágenes, enlaces).
- Actualizaciones de seguridad del CMS, plugins y temas.
- Respaldo (backup) regular de archivos y base de datos.
- Monitoreo de uptime y rendimiento.
- Corrección de errores técnicos menores.
- Soporte técnico vía correo electrónico / ticket / teléfono.
- Actualizaciones menores de diseño (CSS/HTML básico).
- Optimización de velocidad y SEO técnico básico.

**Queda EXCLUIDO de este contrato:**

- Rediseño completo del sitio web.
- Desarrollo de nuevas funcionalidades o módulos complejos.
- Creación de nueva marca, logotipos o identidad visual.
- Marketing digital, gestión de redes sociales o campañas publicitarias.
- Servicios de hosting o registro de dominio (salvo que se acuerde por escrito).

---

## 2. DURACIÓN Y RENOVACIÓN

**2.1.** El presente contrato tendrá una duración inicial de **{{initial_term_months}} meses**, comenzando en la fecha de firma o del primer pago, lo que ocurra último.

**2.2. Renovación:** El contrato se renovará automáticamente por períodos iguales, salvo que cualquiera de las partes notifique por escrito (correo electrónico o carta certificada) su intención de no renovar con al menos **{{cancel_notice_days}}** días naturales de anticipación al vencimiento del período en curso.

---

## 3. COMPENSACIÓN Y PAGOS

**3.1.** El CLIENTE pagará al PROVEEDOR la tarifa mensual/recurrente establecida en el Anexo de Servicios: **{{recurring_terms}}** ({{total_amount}} {{currency}}).

**3.2. Fecha de pago:** Los pagos se realizarán por adelantado, el día **{{billing_day}}** de cada mes/período de facturación.

**3.3. Métodos de pago aceptados:** Tarjeta de crédito/débito, ACH, transferencia bancaria, PayPal, Zelle u otros acordados por escrito.

**3.4. Pagos tardíos:** Los pagos recibidos después de **{{late_days}}** días de la fecha de vencimiento incurrirán en un cargo por mora del **{{late_fee}}** (o el máximo permitido por la ley del estado aplicable). El PROVEEDOR se reserva el derecho de suspender los servicios después de **{{late_suspension_days}}** días de retraso en el pago, previo aviso por escrito.

**3.5. Aumentos de tarifa:** El PROVEEDOR podrá incrementar las tarifas con un preaviso de **{{fee_increase_notice_days}}** días por escrito. Si el CLIENTE no acepta el nuevo precio, podrá terminar el contrato sin penalización al final del período en curso.

---

## 4. OBLIGACIONES DEL CLIENTE

**4.1.** Proporcionar acceso o credenciales necesarias (FTP, cPanel, CMS, hosting, dominio) para realizar el mantenimiento. El CLIENTE garantiza que tiene derecho legal de proporcionar dichos accesos.

**4.2.** Responder a solicitudes de información o aprobación dentro de **{{client_response_days}}** días hábiles.

**4.3.** Realizar copias de seguridad propias si así lo desea, aunque el PROVEEDOR ofrezca respaldos.

**4.4.** No realizar modificaciones directas en el sitio que puedan interferir con el trabajo del PROVEEDOR sin notificación previa.

**4.5.** Cumplir con todas las leyes aplicables (incluyendo, pero no limitado a, leyes de propiedad intelectual, privacidad de datos como CCPA/GDPR si aplica, y regulaciones de la FTC).

---

## 5. OBLIGACIONES DEL PROVEEDOR (LBS)

**5.1.** Realizar los servicios contratados con la diligencia y cuidado razonable de un profesional de la industria.

**5.2.** Responder a solicitudes de soporte dentro del tiempo establecido en el plan contratado (**{{response_time}}**).

**5.3.** Mantener la confidencialidad de la información del CLIENTE (ver Sección 7).

**5.4.** Notificar al CLIENTE de cualquier problema crítico de seguridad detectado.

**5.5. Limitación de responsabilidad:** El PROVEEDOR no será responsable por:

- Pérdida de ingresos, datos o beneficios del CLIENTE.
- Fallas causadas por terceros (hosting, plugins de terceros, ataques cibernéticos fuera del control razonable).
- Daños indirectos, incidentales, especiales o consecuenciales.

**Responsabilidad máxima:** En ningún caso la responsabilidad total del PROVEEDOR excederá el monto total pagado por el CLIENTE en los **{{liability_cap_months}} meses** anteriores al evento que dio origen a la reclamación.

---

## 6. PROPIEDAD INTELECTUAL

**6.1.** El CLIENTE retiene todos los derechos de propiedad sobre su sitio web, marca, contenido y materiales proporcionados.

**6.2.** Cualquier código, script o solución original desarrollada específicamente para el CLIENTE por el PROVEEDOR durante la vigencia de este contrato será propiedad del CLIENTE, una vez pagados todos los servicios correspondientes.

**6.3.** El PROVEEDOR retiene derechos sobre herramientas, frameworks, plantillas o metodologías generales de su propiedad.

---

## 7. CONFIDENCIALIDAD

Ambas partes acuerdan mantener la confidencialidad de toda información no pública, credenciales de acceso, datos de clientes y estrategias de negocio reveladas durante la relación contractual. Esta obligación sobrevive a la terminación del contrato por un período de **{{confidentiality_years}} años**.

---

## 8. TERMINACIÓN

**8.1. Terminación con causa:** Cualquiera de las partes podrá terminar este contrato con efecto inmediato si la otra parte incumple sustancialmente cualquier término y no lo corrige dentro de **{{cure_period_days}}** días después de recibir notificación por escrito.

**8.2. Terminación sin causa:** El CLIENTE podrá terminar en cualquier momento con un preaviso de **{{termination_notice_days}}** días por escrito, quedando obligado al pago de los servicios prestados hasta la fecha de terminación. No se realizarán reembolsos de pagos por adelantado salvo que el PROVEEDOR incumpla sus obligaciones.

**8.3.** Al terminarse: El PROVEEDOR entregará al CLIENTE las credenciales y archivos actualizados del sitio web dentro de **{{credential_handoff_days}}** días hábiles, siempre que no existan pagos pendientes.

---

## 9. INDEMNIZACIÓN

Cada parte indemnizará y mantendrá indemne a la otra frente a reclamaciones, daños o gastos (incluyendo honorarios de abogados razonables) derivados de su propia negligencia, incumplimiento de este contrato o violación de derechos de terceros.

---

## 10. FUERZA MAYOR

Ninguna de las partes será responsable por incumplimientos causados por eventos fuera de su control razonable, incluyendo: desastres naturales, fallas de servicios de internet a nivel regional, pandemias, huelgas, o fallas en servicios de terceros (hosting, proveedores de nube).

---

## 11. LEY APLICABLE Y JURISDICCIÓN

**11.1.** Este contrato se regirá e interpretará de conformidad con las leyes del Estado de **{{governing_state}}**, sin dar efecto a principios de conflicto de leyes.

**11.2. Validez en todo Estados Unidos:** Este contrato es válido y ejecutable en cualquier estado de los Estados Unidos. Para fines de jurisdicción, las partes se someten a los tribunales estatales y federales ubicados en el condado de **{{jurisdiction_county}}**, Estado de **{{jurisdiction_state}}**.

**11.3. Resolución de disputas:** Antes de iniciar cualquier acción legal, las partes se esforzarán en resolver disputas mediante mediación no vinculante. Si la mediación falla, cualquier controversia se resolverá mediante arbitraje vinculante bajo las reglas de la AAA (American Arbitration Association) o litigio en los tribunales mencionados en 11.2, a elección de la parte demandante.

---

## 12. INDEPENDENCIA CONTRACTUAL

El PROVEEDOR es un contratista independiente. Nada en este contrato crea una relación de empleo, sociedad, franquicia o joint venture entre las partes.

---

## 13. COMUNICACIONES

Todas las notificaciones serán válidas si se envían por correo electrónico a las direcciones designadas arriba, o por correo certificado con acuse de recibo a las direcciones postales indicadas.

---

## 14. ACUERDO COMPLETO Y MODIFICACIONES

**14.1.** Este contrato, junto con sus anexos, constituye el acuerdo completo entre las partes y sustituye cualquier acuerdo previo.

**14.2. Modificaciones:** Solo serán válidas las modificaciones realizadas por escrito y firmadas por ambas partes, o por correo electrónico confirmado por ambas partes.

**14.3. Divisibilidad:** Si alguna cláusula es declarada inválida, las demás permanecerán en pleno vigor.

**14.4. Renuncia:** La omisión de exigir el cumplimiento de algún término no constituirá renuncia a derechos futuros.

---

## 15. ANEXO: PLAN DE SERVICIOS CONTRATADO

| Característica | Plan seleccionado |
| --- | --- |
| Nombre del plan | {{subscription_name}} |
| Tarifa mensual | {{total_amount}} |
| Horas de trabajo incluidas | {{included_hours}} |
| Tiempo de respuesta | {{response_time}} |
| Backups | {{backup_frequency}} |
| Actualizaciones de seguridad | {{security_updates}} |
| Soporte vía | {{support_channels}} |
| Horario de soporte | {{support_hours}} |
| Alcance adicional | {{additional_scope}} |

**Líneas de facturación:**

{{line_items}}

---

## FIRMAS

Al firmar, ambas partes reconocen que han leído, entendido y aceptado todos los términos y condiciones de este contrato.

### POR EL PROVEEDOR

**{{provider_name}}** · {{provider_website}}

- Nombre: {{lbs_signatory}}
- Cargo: {{provider_signatory_title}}
- Firma: _________________________
- Fecha: {{signed_at}}

### POR EL CLIENTE

- Nombre: {{client_representative}}
- Cargo: {{client_signatory_title}}
- Firma: _________________________
- Fecha: {{signed_at}}

*Versión del documento: {{terms_version}} · {{provider_name}}*`;

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
