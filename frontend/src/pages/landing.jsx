

"use client";

import { Link } from "react-router-dom";
import { useLocation } from 'react-router-dom';
import { useState } from "react";
import { useEffect } from "react";
import { Button, IconButton, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const username = localStorage.getItem('username');

  
  const [usernameFound, setUsernameFound] = useState(false); // Initialize state

  useEffect(() => {
    if (username) {
      setUsernameFound(true); // Set state if username is found
    } else {
      setUsernameFound(false); // Set state if no username
    }
  }, []); // Dependency array ensures it runs only when username changes




  return (
    <>
      <div
        className="h-screen w-screen bg-gradient-to-br from-blue-400 via-pink-300 to-green-200
 overflow-hidden"
      >
       <div className="flex justify-end px-4 py-3">
  {usernameFound ? (
    
    <div className="flex flex-col justify-end ">
      
    <h1 className="px-3 block rounded-lg py-2.5 text-xl font-semibold text-gray-900 z-50" >Welcome, {username}</h1>
    <Button
  sx={{
    zIndex: 50,
    backgroundColor: 'grey',
    color: 'white',
    '&:hover': {
      backgroundColor: 'red',
    },
    cursor: 'pointer'
  }}
  onClick={() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsernameFound(false);
  }}
>
  Logout
</Button>
   

    

    </div>
  ) : (
    <Link
    
      to="/auth"
       className="px-3 block rounded-lg py-4 text-base font-semibold text-gray-900 z-50 border-2
        border-lime-500 bg-red-300 hover:bg-lime-500 hover:text-white hover:border-lime-600"
    >
      Log in
    </Link>
  )}
</div>



        <div className="relative isolate px-6  lg:px-8 ">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          >
            <div
              style={{
                clipPath:
                  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
              }}
              className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            />
          </div>
          <div className="mx-auto max-w-2xl py-32 sm:py-1 lg:py-56 ">
            <div className="text-center">
              <h1 className="text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-7xl">
              Where Conversations Flow
              </h1>
              <p className="mt-8 text-pretty text-lg font-medium text-gray-500 sm:text-xl/8">
              Connect effortlessly and collaborate in real-time, making every conversation meaningful.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link
                  to={"/home"}
                  className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Join meeting
                </Link>

                <Link
                  to={"/NewMeet"}
                  className="text-md/9 font-semibold text-gray-900"
                >
                  create meeting
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
