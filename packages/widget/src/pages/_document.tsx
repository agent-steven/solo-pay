import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Quantico:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body className="bg-black font-quantico">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
