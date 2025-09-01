# XrplApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.15.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

Issuer Steps

1. Create issuer wallet and set account up
   Account Configuration Templates: Issuer
2. Create hot wallet. This receives token from issuer.
   Set trust line from hot wallet/operational address to issuer
3. Send tokens from issuer to the hot wallet/operational address. This is minting tokens
4. On the Cold Wallet (issuing address)
   Enable asfNoFreeze
   Disable Master key and set the Regular key to blackhole address
5. Any new account will set up trustline with issue and then the hot wallet/operational address will send the token to the new account
6. On the hot wallet/operational address
   Set asfRequiredAuth to stop user from setting trustlines to it since we want trustlines to the issuer.
   Set asfDepositAuth so no one can send it any tokens

Dev Net SCript
Account 1 (warm wallet)
rGmU8kqozDSDGopQwbcB5zivjFoAtoGJKc
sEdTPXyyVHDxGmDRkQk5nPpmYAea8z7
Hot Wallet (operational address)
rD4YFdgy2riRwGWY7Zx7javcA1d8VAPxm8
sEdTozppS3PwQ7GR3UZWhFY3B2iS9aw
Cold Wallet (issuing address)
rwcdkLpcRpPnULPEMf5HtkLKmCAtfD8rFm
sEdTbj6rqRpuC2yv4kHttbXVre9Hcju

Dev Net
Account 1 (warm wallet)
rD2VVnG5A3QAJrMFzAAdkBsqJu56vCnQwy
sEdSQjAbb9SorYGv2wfprPmn82hmox8
Hot Wallet (operational address)
rH8iAisc9asyjKXdkr5KMopuqNBeBhndKz
sEdTvKhkXNdfiMrC37fTWozcQzeEv8L
Cold Wallet (issuing address)
rQUch4yZo1UgqW2PdoMajVZp4Kw36itjeL
sEd7WnRBiSdhM1pV1YYB5XZ5wuT5X3e



Dev Net
Multi-Sign
Signer 1
rGnXL6JafXnidF18i3bgAPirM2dY3CjR1a
sEdTN6sjTnjFs4YVRrSuRpWbzSUz3Cx
Signer 2
rhPQYrsZL1TvHfGjecSxA7Eq8oeQEumKKD
sEdSk8jUZvzbRbCgsGKw3KDzPesit6N
Signer 3
rP6v2pzbhF7MxE2ogWeZSXuNC1fSq3BVVB
sEdTXhkwNsyfCoAi7HduqozcZkAcQHu
Signer 4
rLun1syD3QzM4TMMv7jvBKW1He3AzDDr6P
sEdVSbFNsKKzJgYAYAgbmrFbELUSFip
Signer 5
rPNFwHCvcAq9WFtHaa1JWammtmeQzXm8Kw
sEdVEwbLzukno1yHFjMnNZmfkdirHQK
Signer 6
rHtNpRtDEKzQ4DmtJcPMXByqs2zXkiqTny
sEd7jy8FhyCXiSb2kCBRxaa7D1SxhPK

Deposit Auth
rPxgdSeXYzysPNCnpwa1XmmBHnEZuEixF9
sEdVoPUfVtB9qPTZ2uB9NeFHQnUkd9k
rVJrhReHrc6XVbaLRwJPMqrwWJhBrawKm
sEd7a3kBJtU2NFF1GfmgPNojhKFJ8h1
rPxgdSeXYzysPNCnpwa1XmmBHnEZuEixF9,rVJrhReHrc6XVbaLRwJPMqrwWJhBrawKm

Regular Key
rPUnsU68YvAKg2Tk2dhjCVfUqvzHEEZ81r
sEdVcsjnjzH4Ky7HP8rr5RXJhfGRUR2

Creds Recipient
rJwQPwSWF6Qy2BQNxHzzGgUAJvfVbiHLUG
sEdSArDZDkjbjU3RFnqDKdEpPcTvrpE

Delete this
rwHjj8Ww1yFmKkFY7guaPP2HWP3R9PQDcA
sEdTyNBZCtxHF7mcBFmWz1HYebvmsuB

Cold
rNFvXhgY3LVNFmV9mabYCkAWWCJcDMV4Pt
sEdV4B674ESWjN9BEnrpWaWCfdgMGb3
Hot
r9AADpmbj4aBegtxatperxgPNhuyXvWNDq
sEd7wWzgZXsNoy7vWCeP1X2ng9ZQ9GE

CTZ Issuer
rfW6rbAdysF4ShU7fncCqb2td6fVv3A84P
sEdStZkrzSq5WFhXHY6Fqhfuun18Sz8

TrustLines
rniP9CwpZCSRntbR2Npzh8SUn8gFMsiWUY
sEdTbWV8SSduY5bmxcPzBH8VjmfP2kd
rGiRqiqKmqbtiRWzPTwPw2LrVymyURgxS8
sEdSz7nDukFAek6yhbucsjeLHDAXVFQ

{
"Name": "US Treasury Bill Token",
"Identifier": "USTBT",
"Issuer": "US Treasury",
"IssueDate": "2024-03-25",
"MaturityDate": "2025-03-25",
"FaceValue": 1000,
"InterestRate": 2.5,
"InterestFrequency": "Quarterly",
"Collateral": "US Government",
"Jurisdiction": "United States",
"RegulatoryCompliance": "SEC Regulations",
"SecurityType": "Treasury Bill",
"ExternalUrl": "https://example.com/t-bill-token-metadata.json"
}

ipfs://bafybeiexamplehash

did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey#keys-1
Ed25519VerificationKey2018
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey
GfHkE3R7C6oJtH58eTmRzR
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey#vcs
VerifiableCredentialService
https://example.com/vc/
did:xrpl:raWwLN6xwPcwpLTiuHYf8S8vFaQtRzK9ey#keys-1
