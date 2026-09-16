import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/login/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import KafedralarPage from '../pages/kafedralar/KafedralarPage';
import FennlerPage from '../pages/fenn/FennlerPage';
import TestBankilarPage from '../pages/testBanki/TestBankilarPage';
import MovzularPage from '../pages/movzu/MovzularPage';
import IstifadecilerPage from '../pages/istifadeciler/IstifadecilerPage';
import ProtectedRoute from './ProtectedRoute';
import Layout from '../components/Layout';
import ImtahanlarPage from '../pages/imtahanlar/Imtahanlarpage';
import StudentProtectedRoute from './StudentProtectedRoute';
import StudentLoginPage from '../pages/student/StudentLoginPage';
import StudentDashboardPage from '../pages/student/StudentDashboardPage';
import StudentExamPage from '../pages/student/StudentExamPage';
import TeachersPage from '../pages/muellimler/Teachers';
import MuellimYoxlamaPage from '../pages/muellim/MuellimYoxlamaPage';
import SeviyeEssayYoxlamaPage from '../pages/muellim/SeviyeEssayYoxlamaPage';
import SeviyeImtahaniPage from '../pages/seviyeImtahani/SeviyeImtahaniPage';
import StudentSeviyeImtahaniPage from '../pages/seviyeImtahani/StudentSeviyeImtahaniPage';

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/student/login" element={<StudentLoginPage />} />
      <Route path="/seviye-imtahani/student" element={<StudentSeviyeImtahaniPage />} />
      <Route
        path="/student"
        element={
          <StudentProtectedRoute>
            <StudentDashboardPage />
          </StudentProtectedRoute>
        }
      />
      <Route
        path="/student/exams/:id"
        element={
          <StudentProtectedRoute>
            <StudentExamPage />
          </StudentProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kafedralar"
        element={
          <ProtectedRoute>
            <Layout>
              <KafedralarPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/fennler"
        element={
          <ProtectedRoute>
            <Layout>
              <FennlerPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-banklari"
        element={
          <ProtectedRoute>
            <Layout>
              <TestBankilarPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/movzular"
        element={
          <ProtectedRoute>
            <Layout>
              <MovzularPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/muellimler"
        element={
          <ProtectedRoute>
            <Layout>
              <TeachersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/imtahanlar"
        element={
          <ProtectedRoute>
            <Layout>
              <ImtahanlarPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seviye-imtahani"
        element={<ProtectedRoute><Layout><SeviyeImtahaniPage /></Layout></ProtectedRoute>}
      />
      <Route
        path="/yoxlama"
        element={
          <ProtectedRoute>
            <Layout>
              <MuellimYoxlamaPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/seviye-yoxlama" element={<ProtectedRoute><Layout><SeviyeEssayYoxlamaPage /></Layout></ProtectedRoute>} />
      <Route
        path="/istifadeciler"
        element={
          <ProtectedRoute>
            <Layout>
              <IstifadecilerPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
