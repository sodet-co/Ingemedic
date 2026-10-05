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
      intro="Esta política explica qué datos personales recolectamos, para qué los usamos y cómo puedes ejercer tus derechos, de acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015)."
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
          <li><strong>Formulario de contacto del sitio web:</strong> nombre, teléfono, correo electrónico (opcional), servicio de interés y el mensaje que nos escribas.</li>
          <li><strong>WhatsApp, teléfono y correo:</strong> los datos que nos compartas al comunicarte por esos canales.</li>
          <li><strong>Prestación del servicio:</strong> datos de identificación y contacto de clientes, pacientes y cuidadores, dirección de entrega, equipos entregados, y la firma de quien recibe o devuelve un equipo.</li>
          <li><strong>Portal de clientes:</strong> correo de acceso y registro de la actividad dentro del portal.</li>
          <li><strong>Navegación:</strong> estadísticas agregadas y anónimas de visitas y rendimiento del sitio (ver sección 8).</li>
        </ul>
      </Seccion>

      <Seccion titulo="3. Finalidades">
        <p>Usamos los datos personales para:</p>
        <ul>
          <li>Responder solicitudes de información y elaborar cotizaciones.</li>
          <li>Entregar, instalar, recoger y hacer mantenimiento a los equipos biomédicos y al oxígeno medicinal.</li>
          <li>Dar soporte técnico y hacer seguimiento al servicio.</li>
          <li>Llevar la trazabilidad de los equipos y cumplir las obligaciones sanitarias, de tecnovigilancia, contables y tributarias que nos aplican.</li>
          <li>Facturar y gestionar la relación contractual con clientes e instituciones de salud.</li>
          <li>Atender consultas, peticiones y reclamos.</li>
        </ul>
        <p>No vendemos ni cedemos datos personales a terceros para fines comerciales, y no los usamos para enviar publicidad sin autorización.</p>
      </Seccion>

      <Seccion titulo="4. Datos sensibles y datos de salud">
        <p>
          La información sobre el estado de salud de una persona es un <strong>dato sensible</strong>. Nadie está obligado a suministrarla: solo la tratamos cuando es necesaria para prestar el servicio (por ejemplo, la indicación médica para definir el equipo) y con autorización expresa del titular o de quien lo represente.
        </p>
        <p>
          Para pedir información o una cotización por el formulario web <strong>no hace falta</strong> enviar diagnósticos, historias clínicas ni documentos de identidad. Si nos compartes datos de otra persona (por ejemplo, de un familiar que es paciente), declaras que cuentas con su autorización para hacerlo.
        </p>
        <p>
          Los datos de niños, niñas y adolescentes solo se tratan con autorización de su representante legal y respetando su interés superior.
        </p>
      </Seccion>

      <Seccion titulo="5. Derechos del titular">
        <p>Como titular de los datos puedes:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Solicitar prueba de la autorización que nos diste.</li>
          <li>Ser informado sobre el uso que les hemos dado.</li>
          <li>Revocar la autorización o pedir la supresión de los datos, cuando no exista un deber legal o contractual de conservarlos.</li>
          <li>Acceder gratuitamente a los datos que hayan sido objeto de tratamiento.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el trámite ante nosotros.</li>
        </ul>
      </Seccion>

      <Seccion titulo="6. Cómo ejercer tus derechos">
        <p>
          Escríbenos a <a href={`mailto:${EMPRESA.correoDatos}`}>{EMPRESA.correoDatos}</a> o acércate a nuestra sede en {direccion.calle}, {direccion.ciudad}. Indica tu nombre completo, número de identificación, datos de contacto y una descripción clara de lo que solicitas.
        </p>
        <ul>
          <li><strong>Consultas:</strong> se responden en máximo 10 días hábiles desde su recibo. Si no es posible, te informaremos el motivo y la nueva fecha, que no superará 5 días hábiles adicionales.</li>
          <li><strong>Reclamos</strong> (corrección, actualización, supresión o revocatoria): se responden en máximo 15 días hábiles desde su recibo, prorrogables hasta por 8 días hábiles más informando el motivo. Si el reclamo está incompleto, te pediremos completarlo dentro de los 5 días hábiles siguientes.</li>
        </ul>
      </Seccion>

      <Seccion titulo="7. Encargados y transferencia internacional">
        <p>Para operar el sitio y el servicio nos apoyamos en proveedores tecnológicos que actúan como encargados del tratamiento y pueden almacenar la información en servidores fuera de Colombia:</p>
        <ul>
          <li><strong>Vercel:</strong> alojamiento del sitio web y registros técnicos de funcionamiento.</li>
          <li><strong>Supabase:</strong> base de datos del sistema de gestión y del portal de clientes.</li>
          <li><strong>Google:</strong> envío por correo de los mensajes del formulario de contacto.</li>
          <li><strong>WhatsApp (Meta):</strong> cuando decides escribirnos por ese canal.</li>
        </ul>
        <p>También podemos compartir datos con la EPS, IPS o entidad que ordena o paga el servicio, y con autoridades cuando la ley lo exija.</p>
      </Seccion>

      <Seccion titulo="8. Cookies y analítica">
        <p>
          El sitio público no usa cookies de publicidad ni de seguimiento. Medimos visitas y rendimiento con herramientas de analítica que no usan cookies ni identifican a personas. El portal de clientes y el panel interno usan únicamente cookies de sesión, necesarias para mantener el inicio de sesión.
        </p>
      </Seccion>

      <Seccion titulo="9. Seguridad y conservación">
        <p>
          Aplicamos medidas técnicas y administrativas razonables para evitar la pérdida, el acceso no autorizado o el uso indebido de los datos: acceso con usuario y contraseña, permisos por rol, conexiones cifradas y registro de auditoría.
        </p>
        <p>
          Conservamos los datos mientras dure la relación con el titular y el tiempo adicional que exijan las normas sanitarias, contables y tributarias. Los mensajes del formulario que no deriven en un servicio se eliminan cuando dejan de ser necesarios para responder la solicitud.
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
