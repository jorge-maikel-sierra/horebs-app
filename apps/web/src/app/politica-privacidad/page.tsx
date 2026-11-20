import type { Metadata } from 'next';
import { NEGOCIO } from '@/lib/negocio';
import { openGraphPagina } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Política de privacidad y tratamiento de datos | Pizzería Horebs',
  description:
    'Cómo Pizzería Horebs recopila, usa, comparte y protege tus datos personales al pedir por el sitio, la caja, WhatsApp, Messenger o Instagram, y cómo ejercer tus derechos según la Ley 1581 de 2012.',
  alternates: { canonical: '/politica-privacidad' },
  openGraph: openGraphPagina('/politica-privacidad'),
};

const TITULO = 'text-xl font-semibold text-zinc-900 dark:text-zinc-50';
const CORREO_CONTACTO = 'jorgemaikelsierraamaya@gmail.com';

export default function PoliticaPrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        Política de privacidad y tratamiento de datos personales
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: noviembre de 2026
      </p>

      <div className="mt-10 space-y-8 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className={TITULO}>Quién es el responsable</h2>
          <p className="mt-3">
            {NEGOCIO.nombre} es el responsable del tratamiento de tus datos
            personales. Estamos ubicados en {NEGOCIO.direccion}. Esta política
            aplica a los datos de quienes hacen pedidos o nos contactan por
            nuestro sitio web ({NEGOCIO.sitio}), en el local, por WhatsApp,
            Messenger o Instagram, y se rige por la Ley 1581 de 2012 y sus
            decretos reglamentarios (Régimen General de Protección de Datos
            Personales de Colombia).
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Qué datos recopilamos</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Datos de contacto:</strong> nombre, apellido, teléfono,
              correo electrónico y cédula (solo si nos la das), y la
              dirección de entrega cuando pides a domicilio. Como solo
              atendemos en Riohacha, a cada cliente se le registra por defecto
              la ciudad de Riohacha y el departamento de La Guajira.
            </li>
            <li>
              <strong>Datos del pedido y de tu historial:</strong> productos,
              cantidades, modalidad (local, retiro o domicilio), método de
              pago elegido, fechas, valor de cada compra y los puntos del
              programa de fidelidad. No procesamos ni guardamos números de
              tarjeta: si pagas con tarjeta lo hace nuestro proveedor de pagos.
            </li>
            <li>
              <strong>Cómo llegó tu pedido:</strong> si lo hiciste en el
              local, por llamada, WhatsApp, Messenger, Instagram o el sitio, y
              si venías de un anuncio nuestro.
            </li>
            <li>
              <strong>Mensajes de WhatsApp, Messenger e Instagram:</strong> el
              contenido de lo que nos escribes, tu número o nombre de perfil y
              el anuncio desde el que nos escribiste, para poder atenderte.
            </li>
            <li>
              <strong>Reseñas en Google:</strong> el nombre público, la
              calificación y el comentario de las reseñas que dejas en nuestro
              Perfil de Empresa en Google, para poder responderlas.
            </li>
            <li>
              <strong>Datos técnicos del sitio:</strong> páginas visitadas,
              dirección IP, navegador, parámetros de la campaña de la que
              vienes y los identificadores de las cookies de Meta, para que
              el sitio funcione y para medir nuestra publicidad. También
              grabamos cómo se navega el sitio (clics y desplazamientos) para
              encontrar errores; en esas grabaciones los campos que escribes y
              tus datos de contacto se ocultan.
            </li>
          </ul>
          <p className="mt-3">
            No recopilamos datos sensibles (salud, origen étnico, orientación
            política o religiosa, datos biométricos, entre otros) y nuestros
            servicios no están dirigidos a menores de edad.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Para qué usamos tus datos</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Tomar, preparar, entregar y confirmar tus pedidos.</li>
            <li>
              Responder tus mensajes, incluida la respuesta automática de
              nuestro asistente virtual para consultas de menú, horario y
              estado del pedido.
            </li>
            <li>
              Responder públicamente las reseñas que nos dejas en Google. Las
              de 4 y 5 estrellas pueden recibir una respuesta automática de
              agradecimiento; las demás las revisa una persona del equipo.
            </li>
            <li>
              Enviarte confirmaciones de pedido por correo o WhatsApp, y
              llevar tus puntos del programa de fidelidad.
            </li>
            <li>
              Mejorar nuestro menú, precios y atención con estadísticas de
              ventas y de recompra.
            </li>
            <li>
              Medir y mejorar nuestra publicidad, como se explica en la
              sección siguiente.
            </li>
            <li>
              Cumplir obligaciones contables y legales.
            </li>
          </ul>
          <p className="mt-3">
            No vendemos tus datos. No te enviamos mensajes promocionales por
            WhatsApp fuera de una conversación que tú iniciaste, salvo que lo
            autorices expresamente.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Publicidad y medición con Meta</h2>
          <p className="mt-3">
            Anunciamos en Facebook e Instagram. Para saber qué anuncios
            funcionan y para mostrar nuestros anuncios a las personas
            adecuadas, hacemos lo siguiente con Meta Platforms:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Medición de compras:</strong> cuando haces un pedido le
              informamos a Meta que hubo una compra y su valor, junto con tu
              teléfono, correo, nombre y ciudad <em>cifrados</em> (convertidos
              en un código irreversible antes de salir de nuestros sistemas).
              Meta los compara con sus propias cuentas únicamente para
              saber si esa compra vino de un anuncio.
            </li>
            <li>
              <strong>Listas de clientes:</strong> podemos subir esos mismos
              datos cifrados para crear públicos (por ejemplo, invitar de
              nuevo a quienes no piden hace un tiempo, dejar de mostrar
              anuncios de captación a quien ya es cliente, o encontrar
              personas con intereses parecidos a los de nuestros mejores
              clientes).
            </li>
            <li>
              <strong>Pixel y cookies:</strong> el sitio usa el píxel de Meta
              y Google Tag Manager para medir visitas y compras.
            </li>
          </ul>
          <p className="mt-3">
            Meta trata esos datos según sus propias políticas. Puedes limitar
            la publicidad personalizada desde la configuración de anuncios de
            tu cuenta de Facebook o Instagram, bloquear las cookies en tu
            navegador, o pedirnos que no usemos tus datos para estos fines
            escribiéndonos por los canales de la sección «Cómo ejercer tus
            derechos».
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Con quién compartimos datos</h2>
          <p className="mt-3">
            Para operar usamos proveedores que tratan datos en nuestro nombre
            (encargados del tratamiento), cada uno con acceso limitado a lo
            necesario para su función:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Meta</strong> (WhatsApp, Messenger, Instagram y su
              plataforma de anuncios) — mensajes y medición publicitaria.
            </li>
            <li>
              <strong>Supabase</strong> — base de datos de clientes, pedidos y
              catálogo.
            </li>
            <li>
              <strong>Vercel</strong> y <strong>Railway</strong> — servidores
              del sitio y del sistema de pedidos.
            </li>
            <li>
              <strong>Resend</strong> — envío de correos de confirmación.
            </li>
            <li>
              <strong>Bold</strong> — cobro con tarjeta cuando eliges ese
              método.
            </li>
            <li>
              <strong>Google</strong> (Tag Manager y Perfil de Empresa) —
              gestión de las etiquetas de medición del sitio y lectura y
              respuesta de las reseñas.
            </li>
            <li>
              <strong>PostHog</strong> — analítica del sitio y grabaciones de
              navegación con los datos personales ocultos.
            </li>
          </ul>
          <p className="mt-3">
            Algunos de estos proveedores almacenan o procesan datos en
            servidores fuera de Colombia. Al darnos tus datos autorizas esa
            transmisión y transferencia internacional, que hacemos solo para
            las finalidades de esta política. También podemos entregar datos
            cuando una autoridad competente lo exija.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Tu autorización</h2>
          <p className="mt-3">
            Al hacer un pedido, escribirnos o darnos tus datos en el local
            autorizas de manera previa, expresa e informada el tratamiento
            descrito en esta política. Puedes revocar esa autorización o
            pedir que eliminemos tus datos cuando quieras, salvo cuando
            tengamos un deber legal o contractual de conservarlos.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Cuánto tiempo guardamos tus datos</h2>
          <p className="mt-3">
            Mientras tengas una relación activa con nosotros (pedidos
            recientes o puntos vigentes) y el tiempo adicional que exijan las
            obligaciones contables y legales. Los puntos del programa de
            fidelidad vencen a los 12 meses sin compras.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Tus derechos como titular</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Conocer, actualizar y rectificar tus datos personales.</li>
            <li>Pedir prueba de la autorización que nos diste.</li>
            <li>Saber cómo usamos tus datos.</li>
            <li>
              Revocar la autorización y pedir que eliminemos tus datos cuando
              no se respeten tus derechos o ya no sean necesarios.
            </li>
            <li>Acceder gratis a tus datos personales.</li>
            <li>
              Presentar quejas ante la Superintendencia de Industria y
              Comercio por infracciones a la ley, después de haber consultado
              o reclamado ante nosotros.
            </li>
          </ul>
        </section>

        <section>
          <h2 className={TITULO}>Cómo ejercer tus derechos</h2>
          <p className="mt-3">
            Escríbenos por WhatsApp al {NEGOCIO.whatsapp} o al correo{' '}
            <a
              href={`mailto:${CORREO_CONTACTO}`}
              className="text-accent-ink hover:underline"
            >
              {CORREO_CONTACTO}
            </a>
            , indicando tu nombre y tu teléfono, y qué quieres hacer
            (consultar, corregir, eliminar tus datos o revocar tu
            autorización). Responderemos las consultas en un máximo de 10
            días hábiles y los reclamos en un máximo de 15 días hábiles, y te
            avisaremos si necesitamos más tiempo, como lo permite la ley.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Cambios a esta política</h2>
          <p className="mt-3">
            Podemos actualizar esta política cuando cambien nuestras prácticas
            o los requisitos legales. La fecha de la última actualización
            figura al inicio de esta página y, si el cambio es importante, te
            lo avisaremos por nuestros canales.
          </p>
        </section>
      </div>
    </div>
  );
}
