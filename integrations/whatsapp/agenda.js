// La agenda de WhatsApp: reglas del tipo «el día 2 de cada mes, a las 10:00,
// manda tal plantilla a los contactos activos».
//
// Este archivo es solo el calendario — cuándo toca. Quién dispara es
// `vigia.js`, y quién envía sigue siendo la maquinaria de campañas que ya
// existía. Se separa así porque el cálculo de fechas es lo único que tiene
// aristas, y aislado se puede probar con un reloj falso sin base ni red.
//
// Todo se razona en HORA DE LIMA. El servidor de Railway corre en UTC, así que
// una regla «día 2 a las 10:00» guardada como si fuera UTC se dispararía a las
// 5 de la mañana. Perú no cambia la hora desde 1994, pero el offset se saca de
// Intl y no cableado: un -5 escrito a mano es una bomba de relojería para el
// día en que eso cambie.
'use strict';

const TZ = 'America/Lima';

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Las partes de la hora de Lima para un instante dado. */
function partesLima(instante) {
  const p = Object.fromEntries(FMT.formatToParts(instante).map((x) => [x.type, x.value]));
  // Intl da '24' para medianoche en algunos entornos; se normaliza a 0.
  const hora = Number(p.hour) % 24;
  return { anio: Number(p.year), mes: Number(p.month), dia: Number(p.day), hora, minuto: Number(p.minute) };
}

/** Minutos que Lima lleva respecto a UTC en ese instante (negativo: va detrás). */
function offsetLimaMin(instante) {
  const p = partesLima(instante);
  const comoSiFueraUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  // Se compara contra el instante truncado al minuto, que es la resolución con
  // la que trabaja la agenda.
  const base = Math.floor(instante.getTime() / 60000) * 60000;
  return Math.round((comoSiFueraUTC - base) / 60000);
}

/** El instante UTC que corresponde a un reloj de pared de Lima. */
function instanteDeLima(anio, mes, dia, hora, minuto) {
  const ingenuo = Date.UTC(anio, mes - 1, dia, hora, minuto);
  // Dos pasadas: la primera estima el offset con una fecha aproximada y la
  // segunda lo confirma ya en el instante correcto. En Perú da igual, pero es
  // lo que hace que esto siga siendo cierto si algún día hay horario de verano.
  let t = ingenuo - offsetLimaMin(new Date(ingenuo)) * 60000;
  t = ingenuo - offsetLimaMin(new Date(t)) * 60000;
  return new Date(t);
}

const ultimoDiaDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/**
 * La ocurrencia de una regla dentro de un mes concreto.
 *
 * Si el mes no llega al día pedido —un 31 en febrero— se usa el último día del
 * mes en vez de saltarse el envío. Es la decisión menos sorprendente: quien
 * programa «el 31» quiere decir «a fin de mes», y saltarse febrero, abril,
 * junio, septiembre y noviembre sería la mitad del año en silencio.
 */
function ocurrenciaEnMes(regla, anio, mes) {
  const dia = Math.min(Number(regla.dia), ultimoDiaDelMes(anio, mes));
  return instanteDeLima(anio, mes, dia, Number(regla.hora) || 0, Number(regla.minuto) || 0);
}

/** La etiqueta que identifica una ocurrencia. Es la llave contra duplicados. */
function marcaDe(instante) {
  const p = partesLima(instante);
  const dd = (n) => String(n).padStart(2, '0');
  return `${p.anio}-${dd(p.mes)}-${dd(p.dia)} ${dd(p.hora)}:${dd(p.minuto)}`;
}

const mesAnterior = (anio, mes) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
const mesSiguiente = (anio, mes) => (mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 });

/** La última ocurrencia que ya pasó (o cae justo ahora). */
function ocurrenciaVencida(regla, ahora = new Date()) {
  const p = partesLima(ahora);
  const deEsteMes = ocurrenciaEnMes(regla, p.anio, p.mes);
  if (deEsteMes.getTime() <= ahora.getTime()) return deEsteMes;
  const ant = mesAnterior(p.anio, p.mes);
  return ocurrenciaEnMes(regla, ant.anio, ant.mes);
}

/**
 * La próxima ocurrencia. `null` si es de una sola vez y ya se mandó.
 *
 * Ojo con cuál campo dice «ya se mandó»: es `ultimo_envio`, no
 * `marca_disparada`. La marca se sella también AL CREAR la regla, para que
 * programar algo a una hora que ya pasó hoy no dispare la campaña en el acto;
 * mirando la marca, una regla de una sola vez nacía diciendo «ya se mandó» y no
 * llegaba a mandarse nunca. `ultimo_envio` solo lo escribe el vigía al disparar.
 */
function proximaOcurrencia(regla, ahora = new Date()) {
  if (regla.repetir === 'una_vez' && regla.ultimo_envio) return null;
  const p = partesLima(ahora);
  const deEsteMes = ocurrenciaEnMes(regla, p.anio, p.mes);
  if (deEsteMes.getTime() > ahora.getTime()) return deEsteMes;
  const sig = mesSiguiente(p.anio, p.mes);
  return ocurrenciaEnMes(regla, sig.anio, sig.mes);
}

// Cuánto se tolera llegar tarde a una ocurrencia. Si el servidor estuvo caído
// tres horas, al volver NO se manda la campaña que tocaba: un mensaje de
// marketing a destiempo es peor que uno no enviado, y una ráfaga de campañas
// atrasadas al arrancar sería peor todavía. Fuera de la ventana, esa ocurrencia
// se da por perdida y se espera a la siguiente.
const GRACIA_MS = 60 * 60 * 1000;

/**
 * ¿Toca mandar esta regla ahora mismo? Devuelve la marca de la ocurrencia que
 * habría que disparar, o null.
 */
function toca(regla, ahora = new Date()) {
  if (!regla.activa) return null;
  if (regla.repetir === 'una_vez' && regla.ultimo_envio) return null;
  const vencida = ocurrenciaVencida(regla, ahora);
  const atraso = ahora.getTime() - vencida.getTime();
  if (atraso < 0 || atraso > GRACIA_MS) return null;
  const marca = marcaDe(vencida);
  if (regla.marca_disparada === marca) return null;   // ya se mandó
  return marca;
}

module.exports = {
  TZ, GRACIA_MS,
  partesLima, instanteDeLima, ultimoDiaDelMes,
  ocurrenciaEnMes, ocurrenciaVencida, proximaOcurrencia, marcaDe, toca,
};
