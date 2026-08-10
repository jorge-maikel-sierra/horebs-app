import { NEGOCIO } from './negocio';

export const FAQS = [
  {
    pregunta: '¿Qué tamaños de pizza manejan?',
    respuesta:
      'La mayoría de nuestras pizzas vienen en tres tamaños: Personal, Mediana y Grande. El precio de cada tamaño está siempre visible en la ficha de cada producto.',
  },
  {
    pregunta: '¿Cuál es el horario de atención?',
    respuesta: `Atendemos ${NEGOCIO.horario}.`,
  },
  {
    pregunta: '¿Hacen domicilios o solo retiro en el local?',
    respuesta:
      'Las dos cosas: al finalizar tu compra elegís si querés que te lo llevemos a domicilio o preferís retirarlo vos mismo en el local.',
  },
  {
    pregunta: '¿Cuánto cuesta el domicilio?',
    respuesta:
      'El costo varía según la zona de entrega. Si querés confirmarlo antes de pedir, escribinos por WhatsApp.',
  },
  {
    pregunta: '¿Qué métodos de pago aceptan?',
    respuesta:
      'Podés pagar en efectivo, por transferencia bancaria o con tarjeta al finalizar tu pedido.',
  },
  {
    pregunta: '¿Necesito crear una cuenta para pedir?',
    respuesta:
      'No es obligatorio: podés pedir como invitado completando tus datos en el checkout. Si preferís, también podés crear una cuenta desde la sección Cuenta.',
  },
  {
    pregunta: '¿Puedo hacer mi pedido por WhatsApp en vez de la web?',
    respuesta:
      'Sí, también podés escribirnos directo por WhatsApp y armamos tu pedido por ahí.',
  },
  {
    pregunta: '¿Qué otros productos tienen además de pizza?',
    respuesta:
      'Además de nuestras pizzas también tenemos panzerottis y otras variedades — el catálogo completo está siempre actualizado.',
  },
  {
    pregunta: '¿Cómo sé que mi pedido quedó registrado?',
    respuesta:
      'Al confirmar tu compra vas a ver una pantalla con el resumen de tu pedido y un número de confirmación.',
  },
  {
    pregunta: '¿Puedo modificar o cancelar un pedido después de confirmarlo?',
    respuesta: 'Escribinos por WhatsApp cuanto antes y te ayudamos a resolverlo.',
  },
  {
    pregunta: '¿Dónde están ubicados?',
    respuesta: NEGOCIO.direccion,
  },
] as const;
