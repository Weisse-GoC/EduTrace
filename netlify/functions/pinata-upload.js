//edutrace/netlify/functions/pinata-upload.js
/* global process */
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pinataJwt = process.env.PINATA_JWT;

  if (!pinataJwt) {
    return new Response(JSON.stringify({ error: "PINATA_JWT is not configured on the server." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { fileName, fileType, fileBase64 } = await req.json();

    if (!fileName || !fileType || !fileBase64) {
      return new Response(JSON.stringify({ error: "Missing file payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const base64Payload = fileBase64.includes(",")
      ? fileBase64.split(",")[1]
      : fileBase64;

    const bytes = Uint8Array.from(atob(base64Payload), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: fileType });
    const formData = new FormData();
    formData.append("file", blob, fileName);

    const metadata = JSON.stringify({
      name: fileName,
    });
    formData.append("pinataMetadata", metadata);

    const uploadResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: formData,
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      return new Response(
        JSON.stringify({
          error: uploadData?.error?.reason || uploadData?.message || "Pinata upload failed.",
          details: uploadData,
        }),
        {
          status: uploadResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        cid: uploadData.IpfsHash,
        url: `https://gateway.pinata.cloud/ipfs/${uploadData.IpfsHash}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "Unexpected upload failure.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
