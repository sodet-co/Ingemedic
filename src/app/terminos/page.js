import Link from 'next/link'
import PaginaLegal, { Seccion } from '@/components/PaginaLegal'
import { EMPRESA, metadatosPagina } from '@/lib/sitio'

export const metadata = metadatosPagina({
  titulo: 'Términos y condiciones de uso',
  descripcion:
    'Condiciones de uso del sitio web de Ingemedic de Colombia S.A.S.: alcance de la información, cotizaciones, propiedad intelectual y canales de atención.',
  ruta: '/terminos',
})

export default function TerminosPage() {
  const { direccion } = EMPRESA
  return (
    <PaginaLegal
      titulo="Términos y condiciones de uso"
      intro="Al navegar este sitio aceptas las condiciones que se describen a continuación."
    >
      <Seccion titulo="1. Quiénes somos">
        <p>
          Este sitio es operado por <strong>{EMPRESA.nombre}</strong>{EMPRESA.nit ? `, NIT ${EMPRESA.nit}` : ''}, con domicilio en {direccion.calle}, {direccion.ciudad}, {direccion.region}, Colombia. Puedes contactarnos en los teléfonos {EMPRESA.telefonos.join(' y ')} o en <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
        </p>
      </Seccion>

      <Seccion titulo="2. Alcance de la información">
        <p>
          El contenido del sitio es informativo. El portafolio muestra los equipos y servicios que ofrecemos, pero no constituye una oferta vinculante: la disponibilidad, las características, los precios y los tiempos de entrega se confirman en cada cotización.
        </p>
        <p>
          Las imágenes son de referencia; el modelo o la presentación del equipo entregado puede variar manteniendo la misma función.
        </p>
      </Seccion>

      <Seccion titulo="3. No es consejo médico">
        <p>
          La información del sitio no reemplaza la valoración, el diagnóstico ni la prescripción de un profesional de la salud. El uso de oxígeno medicinal y de equipos biomédicos debe seguir la indicación del médico tratante. Ante una urgencia médica, comunícate con la línea de emergencias o acude al servicio de urgencias más cercano.
        </p>
      </Seccion>

      <Seccion titulo="4. Cotizaciones y contratación">
        <p>
          En este sitio no se realizan compras ni pagos en línea. El alquiler de equipos y el suministro de oxígeno se formalizan directamente con nuestro equipo, y las condiciones de cada servicio (valor, plazo, entrega, devolución y garantías) son las que consten en la cotización, el contrato o el acta de entrega correspondiente.
        </p>
      </Seccion>

      <Seccion titulo="5. Portal de clientes">
        <p>
          El acceso al portal es personal e intransferible. Cada cliente es responsable de custodiar sus credenciales y de avisarnos si sospecha de un uso no autorizado. Podemos suspender un acceso cuando sea necesario para proteger la información.
        </p>
      </Seccion>

      <Seccion titulo="6. Propiedad intelectual">
        <p>
          Los textos, imágenes, logotipos y el diseño del sitio pertenecen a {EMPRESA.nombre} o se usan con autorización de sus titulares. No está permitido reproducirlos con fines comerciales sin autorización previa y escrita. Las marcas de los equipos pertenecen a sus respectivos fabricantes.
        </p>
      </Seccion>

      <Seccion titulo="7. Enlaces a terceros">
        <p>
          El sitio incluye enlaces a servicios de terceros, como WhatsApp o el registro del INVIMA. No controlamos su contenido ni sus políticas, y su uso se rige por las condiciones de cada uno.
        </p>
      </Seccion>

      <Seccion titulo="8. Datos personales">
        <p>
          El tratamiento de los datos que nos entregues se rige por nuestra <Link href="/politica-de-datos">política de tratamiento de datos personales</Link>.
        </p>
      </Seccion>

      <Seccion titulo="9. Peticiones, quejas y reclamos">
        <p>
          Puedes presentar peticiones, quejas, reclamos o reportar un incidente con un equipo por cualquiera de los canales de la página de <Link href="/contacto">contacto</Link>.
        </p>
      </Seccion>

      <Seccion titulo="10. Ley aplicable y cambios">
        <p>
          Estos términos se rigen por las leyes de la República de Colombia. Podemos actualizarlos en cualquier momento; la versión vigente es la publicada en esta página.
        </p>
      </Seccion>
    </PaginaLegal>
  )
}
