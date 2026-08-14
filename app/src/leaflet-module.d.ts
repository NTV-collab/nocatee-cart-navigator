declare module "leaflet" {
  // Leaflet is used through dynamic import in the client-only map
  // component; we access it as `any` there. This shim keeps the SSR
  // typecheck happy without shipping Leaflet's type package.
  const L: any;
  export default L;
}