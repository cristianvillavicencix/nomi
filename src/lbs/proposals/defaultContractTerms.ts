import { DEFAULT_CONTRACT_VARIABLES } from "@/lbs/proposals/proposalCommercialConstants";

export const LBS_DEFAULT_CONTRACT_TERMS_VERSION = "1.0";

export const LBS_DEFAULT_CONTRACT_TERMS_TITLE =
  "Service Terms and Conditions — Latinos Business Support (LBS)";

/** Legal document body (Spanish). Variables use {{double_braces}} for merge at contract generation. */
export const LBS_DEFAULT_CONTRACT_TERMS_BODY = `# Términos y Condiciones del Servicio — Latinos Business Support (LBS)

## 1. Partes del Acuerdo

Este Acuerdo de Servicios ("Acuerdo") se celebra entre **Latinos Business Support LLC** ("LBS", "nosotros", "el Proveedor"), con domicilio en Stamford, Connecticut, y **{{client_name}}** ("el Cliente", "usted"), con domicilio en {{client_address}}, con fecha de **{{contract_date}}**.

Este Acuerdo se basa en la Propuesta N.º **{{proposal_number}}** aceptada por el Cliente el **{{accepted_at}}**, la cual se incorpora por referencia.

## 2. Alcance del Servicio (Scope)

LBS prestará los servicios detallados en la Propuesta aceptada, que incluyen los siguientes conceptos:

{{line_items}}

**Definiciones importantes:**
- El alcance se limita exclusivamente a lo enumerado arriba. Cualquier trabajo adicional ("out of scope") requerirá una propuesta complementaria y un costo adicional acordado por escrito.
- Para servicios de desarrollo o rediseño web, "entrega" significa la publicación del sitio aprobado por el Cliente en el dominio/hosting indicado.
- Para servicios recurrentes (hosting, mantenimiento, SEO, publicidad), el servicio se presta de forma continua según la frecuencia indicada en la Propuesta.

## 3. Responsabilidades del Cliente

El Cliente se compromete a:
- Proporcionar de manera oportuna todo el contenido necesario (textos, imágenes, logotipos, accesos, información del negocio).
- Designar a una persona de contacto con autoridad para aprobar entregables.
- Responder a solicitudes de aprobación dentro de **{{client_response_days}}** días hábiles. Las demoras del Cliente pueden extender los plazos de entrega sin penalización para LBS.
- Garantizar que todo el material entregado a LBS no infringe derechos de terceros.

## 4. Plazos y Revisiones

- El cronograma estimado de entrega es de **{{timeline}}**, contado a partir de la recepción del depósito inicial y de todo el contenido requerido.
- La Propuesta incluye hasta **{{revision_rounds}}** rondas de revisión por entregable. Revisiones adicionales se facturan por separado.
- Los plazos son estimados de buena fe y pueden ajustarse por demoras del Cliente o causas de fuerza mayor.

## 5. Precios y Condiciones de Pago

**5.1 Monto total.** El costo total de los servicios es de **{{total_amount}}** ({{currency}}), según el desglose de la Sección 2.

**5.2 Depósito inicial.** El Cliente pagará un depósito del **cincuenta por ciento (50%)** del monto total ({{deposit_amount}}) al momento de firmar/aceptar este Acuerdo. **El trabajo no comienza hasta recibir el depósito.**

**5.3 Saldo restante.** El 50% restante ({{balance_amount}}) se pagará conforme al plan de pagos acordado en la Propuesta:

{{payment_schedule}}

**5.4 Débito automático.** El Cliente autoriza a LBS (o a su procesador de pagos autorizado) a realizar **cargos automáticos recurrentes** al método de pago registrado, en las fechas y montos del plan de pagos de la Sección 5.3, hasta cubrir el saldo total.

**5.5 Servicios recurrentes.** Los servicios marcados como recurrentes se facturan de forma continua a la frecuencia indicada ({{recurring_terms}}) y se renuevan automáticamente hasta que el Cliente cancele con **{{cancel_notice_days}}** días de aviso.

**5.6 Pagos atrasados.** Los pagos vencidos por más de **{{late_days}}** días pueden generar la suspensión del servicio y/o un recargo del **{{late_fee}}**.

**5.7 Impuestos.** Los montos no incluyen impuestos aplicables, los cuales serán responsabilidad del Cliente cuando corresponda.

## 6. Vigencia del Proposal

Esta Propuesta y los precios indicados son válidos por **{{proposal_validity_days}}** días a partir de su emisión. Pasado ese plazo, LBS puede revisar los precios.

## 7. Propiedad Intelectual

- **Antes del pago total:** todo el trabajo, código, diseño y materiales producidos por LBS son propiedad de LBS.
- **Tras el pago total:** LBS transfiere al Cliente la propiedad del producto final entregado, salvo componentes de terceros y metodologías propias de LBS.

## 8. Hosting, Dominios y Accesos

Si LBS gestiona el hosting o dominio, estos se mantienen activos mientras el Cliente esté al corriente en sus pagos.

## 9. Garantía y Soporte

LBS corregirá sin costo los errores reportados dentro de **{{warranty_days}}** días posteriores a la entrega.

## 10. Limitación de Responsabilidad

La responsabilidad total de LBS bajo este Acuerdo no excederá el monto efectivamente pagado por el Cliente.

## 11. Cancelación y Terminación

Cualquiera de las partes puede terminar este Acuerdo con **{{termination_notice_days}}** días de aviso por escrito. El depósito inicial no es reembolsable una vez iniciado el trabajo.

## 12. Confidencialidad

Ambas partes mantendrán confidencial toda información sensible del negocio compartida durante la relación.

## 13. Ley Aplicable

Este Acuerdo se rige por las leyes del Estado de **Connecticut, EE. UU.**

## 14. Aceptación

Al firmar electrónicamente, hacer clic en "Aceptar" o realizar el pago del depósito, el Cliente declara haber leído y aceptado estos Términos.

**Cliente:** {{client_name}}
**Aceptado el:** {{signed_at}}
**Dirección IP de aceptación:** {{signed_ip}}

**Por LBS:** {{lbs_signatory}}

*Versión del documento: {{terms_version}} · Latinos Business Support LLC · Stamford, CT*`;

export const getDefaultContractTermsSeed = () => ({
  version: LBS_DEFAULT_CONTRACT_TERMS_VERSION,
  title: LBS_DEFAULT_CONTRACT_TERMS_TITLE,
  body_markdown: LBS_DEFAULT_CONTRACT_TERMS_BODY,
  default_variables: { ...DEFAULT_CONTRACT_VARIABLES },
  is_active: true,
});
