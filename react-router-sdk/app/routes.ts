import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('gates', 'routes/gates.tsx'),
  route('programmatic', 'routes/programmatic.tsx'),
  route('identity', 'routes/identity.tsx'),
  route('orders', 'routes/orders.tsx'),
  route('filters', 'routes/filters.tsx'),
] satisfies RouteConfig
