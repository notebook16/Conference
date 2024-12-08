import { useState } from 'react'

import './App.css'
import LandingPage from './pages/landing'
import Auth from './pages/auth'

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeet from './pages/VideoMeet';
import Home from './pages/Home';
import History from './pages/History';

function App() {
 

  return (
    <>
      <Router>
       <AuthProvider>
        <Routes>
          <Route path = '/' element = { <LandingPage/>} />
          <Route path = '/auth' element = { <Auth/> }/>
          <Route path='/home' element = {<Home/>} />
          <Route path='/history' element={<History />} />
          <Route path='/:url' element= {<VideoMeet/>} />
        </Routes>
        </AuthProvider> 
      </Router>
       
    </>
  )
}

export default App
