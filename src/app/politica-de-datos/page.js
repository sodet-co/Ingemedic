import Link from 'next/link'
import PaginaLegal, { Seccion } from '@/components/PaginaLegal'
import { EMPRESA, metadatosPagina } from '@/lib/sitio'

export const metadata = metadatosPagina({
  titulo: 'Política de tratamiento de datos personales',
  descripcion:
    'Cómo Ingemedic de Colombia S.A.S. recolecta, usa y protege los datos personales, y cómo ejercer los derechos de habeas data (Ley 1581 de 2012).',
  ruta: '/politica-de-datos',
})

export default function PoliticaDeDatosPage() {
  const { direccion } = EMPRESA
  return (
    <PaginaLegal
      titulo="Política de tratamiento de datos personales"
      intro="Esta política explica qué datos personales recolectamos, para qué los usamos y cómo puedes ejercer tus derechos, de acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013."
    >
      <Seccion titulo="1. Responsable del tratamiento">
        <ul>
          <li><strong>Razón social:</strong> {EMPRESA.nombre}</li>
          {EMPRESA.nit && <li><strong>NIT:</strong> {EMPRESA.nit}</li>}
          <li><strong>Domicilio:</strong> {direccion.calle}, {direccion.ciudad}, {direccion.region}, Colombia</li>
          <li><strong>Teléfonos:</strong> {EMPRESA.telefonos.join(' · ')}</li>
          <li><strong>Correo para datos personales:</strong> <a href={`mailto:${EMPRESA.correoDatos}`}>{EMPRESA.correoDatos}</a></li>
        </ul>
      </Seccion>

      <Seccion titulo="2. Datos que recolectamos">
        <ul>
          <li><strong>Al contactarnos</strong> (formulario del sitio, WhatsApp, teléfono o correo): nombre, teléfono, correo electrónico y el mensaje que nos escribas.</li>
          <li><strong>Al prestar el servicio:</strong> nombre, número de identificación, dirección y teléfono del cliente y de la persona que usa o recibe el equipo, los equipos entregados y la firma de quien los recibe o devuelve.</li>
          <li><strong>Al navegar el sitio:</strong> estadísticas anónimas de uso, que no identifican a ninguna persona.</li>
        </ul>
        <p>
          No solicitamos diagnósticos ni información médica. Para pedir información o una cotización no hace falta enviarla.
        </p>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <ul>
          <li>Responder solicitudes de información y elaborar cotizaciones.</li>
          <li>Entregar, instalar, recoger y hacer mantenimiento a los equipos.</li>
          <li>Dar soporte técnico y hacer seguimiento al servicio.</li>
          <li>Gestionar la relación contractual y cumplir nuestras obligaciones legales.</li>
          <li>Atender consultas, peticiones y reclamos.</li>
        </ul>
        <p>No vendemos datos personales ni los usamos para enviar publicidad sin autorización.</p>
      </Seccion>

      <Seccion titulo="4. Datos de otras personas">
        <p>
          Si nos compartes datos de otra persona (por ejemplo, de un familiar que va a usar el equipo), declaras que cuentas con su autorización para hacerlo.
        </p>
      </Seccion>

      <Seccion titulo="5. Derechos del titular">
        <p>Como titular de los datos puedes:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Solicitar prueba de la autorización que nos diste.</li>
          <li>Ser informado sobre el uso que les hemos dado.</li>
          <li>Revocar la autorización o pedir la supresión de los datos, cuando no exista un deber legal o contractual de conservarlos.</li>
          <li>Acceder gratuitamente a tus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el trámite ante nosotros.</li>
        </ul>
      </Seccion>

      <Seccion titulo="6. Cómo ejercer tus derechos">
        <p>
          Escríbenos a <a href={`mailto:${EMPRESA.correoDatos}`}>{EMPRESA.correoDatos}</a> o acércate a nuestra sede en {direccion.calle}, {direccion.ciudad}. Indica tu nombre completo, número de identificación, datos de contacto y lo que solicitas.
        </p>
        <ul>
          <li><strong>Consultas:</strong> se responden en máximo 10 días hábiles, prorrogables hasta por 5 días hábiles más informando el motivo.</li>
          <li><strong>Reclamos</strong> (corrección, actualización, supresión o revocatoria): se responden en máximo 15 días hábiles, prorrogables hasta por 8 días hábiles más informando el motivo.</li>
        </ul>
      </Seccion>

      <Seccion titulo="7. Con quién se comparten">
        <p>
          Para operar el sitio y prestar el servicio nos apoyamos en proveedores tecnológicos que tratan los datos por nuestra cuenta y pueden almacenarlos en servidores fuera de Colombia. También pueden conocerlos la entidad que contrata el servicio y las autoridades cuando la ley lo exija.
        </p>
      </Seccion>

      <Seccion titulo="8. Cookies">
        <p>
          El sitio público no usa cookies de publicidad ni de seguimiento. El portal de clientes usa únicamente las cookies necesarias para mantener el inicio de sesión.
        </p>
      </Seccion>

      <Seccion titulo="9. Seguridad y conservación">
        <p>
          Aplicamos medidas técnicas y administrativas razonables para evitar la pérdida, el acceso no autorizado o el uso indebido de los datos. Los conservamos mientras dure la relación con el titular y el tiempo adicional que exija la ley.
        </p>
      </Seccion>

      <Seccion titulo="10. Vigencia y cambios">
        <p>
          Cualquier cambio sustancial a esta política se publicará en esta página con su nueva fecha de vigencia. Consulta también los <Link href="/terminos">términos y condiciones de uso</Link> del sitio.
        </p>
      </Seccion>
    </PaginaLegal>
  )
}
