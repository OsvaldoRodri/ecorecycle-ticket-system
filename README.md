# EcoRecycle — Sistema de Tickets de Pago 🎫

Sistema interno de gestión de tickets de pago para proveedores de un centro de reciclaje en California, EUA. **Proyecto profesional en uso activo en producción.**

## El problema que resuelve

El proceso anterior era completamente manual: calculadora + Excel + notas en papel.

| | Antes | Con EcoRecycle |
|---|---|---|
| Tiempo por operación | ~15 minutos | ~3 minutos |
| Distribución de materiales | Manual, propenso a errores | Automatizada |
| Tickets por sesión | Inconsistentes | Numerados y organizados |
| Cálculo de precios | Manual | Automático (tiers alto/bajo) |

**Reducción del 80% en tiempo de procesamiento por operación.**

## Funcionalidades

### Gestión de materiales y precios
- 10 tipos de material: Aluminium Cans, PET #1, SP-PET, Glass, SP-Glass, HDPE, SP-HDPE, #6, #7, Biometal
- Sistema de precios diferenciados: precio **alto** y **bajo** por material
- Los materiales de vidrio (Glass, SP-Glass) tienen lógica separada por diferencia de peso

### Generación de tickets
- Distribución automática de libras entre múltiples tickets
- Algoritmo de asignación con variedad controlada (evita tickets idénticos)
- Numeración secuencial automática (`#001`, `#002`, ...)
- Tickets "prefilled" para flujos especiales

### Sistema WDS (Waste Distribution System)
- Manejo de cajas por cantidad
- Cálculo de CRV (California Redemption Value)
- Distribución inteligente entre tickets

### Gestión de sesión
- Persistencia de estado con `localStorage`
- Snapshots para comparación antes/después
- Asignación aleatoria de nombres de proveedores

## Stack técnico

```
React 18          — UI y estado con hooks (useState, useEffect)
JavaScript ES6+   — lógica de negocio, algoritmos de distribución
Vite 5            — bundler y dev server
JSX               — componentes de interfaz
localStorage      — persistencia de datos entre sesiones
```

## Arquitectura del componente principal

```
App.jsx (1,484 líneas)
├── DATA           — materiales con precios, lista de nombres
├── HELPERS        — funciones puras: redondeo, ordenamiento, renumeración
├── SKIP ASSIGNMENT — algoritmo de distribución de materiales por ticket
├── WDS LOGIC      — cálculo de cajas y CRV
├── TICKET ENGINE  — generación y manipulación de tickets
└── UI RENDER      — interfaz de usuario con React hooks
```

> **Nota de desarrollo:** La app está actualmente en un solo componente (arquitectura monolítica). La siguiente versión refactorizará a estructura MVC con componentes separados por responsabilidad.

## Cómo correr el proyecto

```bash
git clone https://github.com/OsvaldoRodri/ecorecycle-ticket-system.git
cd ecorecycle-ticket-system
npm install
npm run dev
```

Abrir `http://localhost:5173`

**Requisitos:** Node.js 18+, npm

## Contexto del proyecto

Desarrollado para **Renovate Recycling Center** (California, EUA) donde trabajo como asistente operativo. El sistema surgió de una necesidad real: el proceso manual de tickets era lento, inconsistente y propenso a errores de cálculo.

Inicialmente generado con asistencia de IA para el prototipo inicial, luego iterado, corregido y mantenido de forma activa para adaptarse al flujo operativo real del negocio.

## Lo que aprendí construyendo esto

- Gestión de estado complejo con múltiples `useState` interdependientes
- Algoritmos de distribución con restricciones (tiers, variedad, mínimos)
- Persistencia con `localStorage` y manejo de snapshots
- Debugging de lógica de negocio en producción con usuarios reales
- El valor de un README que explique el **impacto**, no solo el código

## Próximas mejoras planificadas

- [ ] Refactorizar a arquitectura MVC con componentes separados
- [ ] Agregar backend con Spring Boot para persistencia real en base de datos
- [ ] Historial de tickets por fecha
- [ ] Exportación a PDF

## Tecnologías

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)

---

*Proyecto profesional en producción — [Osvaldo Rodríguez](https://github.com/OsvaldoRodri)*
