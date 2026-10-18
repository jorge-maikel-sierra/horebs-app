import { NEGOCIO } from './negocio';
import { formatPrecio } from './formato';

/**
 * Las primeras PREGUNTAS_DESTACADAS se muestran abiertas a la vista en la
 * home; el resto queda detrás de "Ver todas las preguntas" (sigue en la
 * página, así el JSON-LD de FAQ coincide con lo visible). El orden sale de
 * lo que más pesa antes de pedir: cómo llega el pedido, cuánto cuesta y
 * cómo se paga.
 */
export const PREGUNTAS_DESTACADAS = 5;

export const FAQS = [
  {
    pregunta: '¿Hacen domicilios o solo retiro en el local?',
    respuesta:
      'Las dos cosas: al finalizar tu compra eliges si quieres que te lo llevemos a domicilio o prefieres retirarlo tú mismo en el local.',
  },
  {
    pregunta: '¿Cuánto cuesta el domicilio?',
    respuesta: `El domicilio cuesta ${formatPrecio(NEGOCIO.costoDomicilio)} y se suma al total de tu pedido. Si lo retiras en el local, no pagas domicilio.`,
  },
  {
    pregunta: '¿Qué métodos de pago aceptan?',
    respuesta:
      'Puedes pagar en efectivo, por transferencia bancaria o con tarjeta al finalizar tu pedido.',
  },
  {
    pregunta: '¿Cuál es el horario de atención?',
    respuesta: `Atendemos ${NEGOCIO.horario}.`,
  },
  {
    pregunta: '¿Cómo sé que mi pedido quedó registrado?',
    respuesta:
      'Al confirmar tu compra vas a ver una pantalla con el resumen de tu pedido y un número de confirmación.',
  },
  {
    pregunta: '¿Qué tamaños de pizza manejan?',
    respuesta:
      'La mayoría de nuestras pizzas vienen en tres tamaños: Personal (6 porciones, 24 cm), Mediana (8 porciones, 30 cm) y Grande (12 porciones, 40 cm). El precio de cada tamaño está en la ficha de cada producto.',
  },
  {
    pregunta: '¿Necesito crear una cuenta para pedir?',
    respuesta:
      'No es obligatorio: puedes pedir como invitado completando tus datos en el checkout. Si prefieres, también puedes crear una cuenta desde la sección Cuenta.',
  },
  {
    pregunta: '¿Puedo hacer mi pedido por WhatsApp en vez de la web?',
    respuesta:
      'Sí, también puedes escribirnos directo por WhatsApp y armamos tu pedido por ahí.',
  },
  {
    pregunta: '¿Qué otros productos tienen además de pizza?',
    respuesta:
      'Además de nuestras pizzas también tenemos panzerottis y otras variedades. El catálogo completo está siempre actualizado.',
  },
  {
    pregunta: '¿Puedo modificar o cancelar un pedido después de confirmarlo?',
    respuesta: 'Escríbenos por WhatsApp cuanto antes y te ayudamos a resolverlo.',
  },
  {
    pregunta: '¿Dónde están ubicados?',
    respuesta: NEGOCIO.direccion,
  },
] as const;
