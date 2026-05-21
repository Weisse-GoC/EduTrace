const key = import.meta.env.VITE_PINATA_KEY;
const secret = import.meta.env.VITE_PINATA_SECRET;

export const pinFileToIPFS = async (file) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let data = new FormData();
    data.append('file', file);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'pinata_api_key': key,
            'pinata_secret_api_key': secret
        },
        body: data
    });
    
    return await response.json();
};

export const pinata = { upload: pinFileToIPFS };