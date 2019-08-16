declare module "net" {
  interface Socket {
    address(): AddressInfo;
  }
}
