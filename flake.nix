{
  description = "TypeScript dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    ,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.typescript-language-server
            pkgs.python3
            pkgs.nodejs
            pkgs.nodePackages.typescript
            pkgs.nodePackages.eslint
            pkgs.nodePackages.prettier
          ];
        };
      }
    );
}
