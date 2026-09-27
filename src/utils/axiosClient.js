import axios from "axios"

const axiosClient =  axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    timeout: 20000, // nothing should legitimately take longer than this — better a clear "try again" than an endless spinner
    headers: {
        'Content-Type': 'application/json'
    }
});


export default axiosClient;