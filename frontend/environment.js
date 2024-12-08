
let is_prod = true;


const server= is_prod ?
 "https://conference-3cu1.onrender.com" :
    "http://localhost:8000" 
  

export default server;