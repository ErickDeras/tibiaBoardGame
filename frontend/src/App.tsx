import { Navigate, Route, Routes } from "react-router-dom";
import { BoardGamePage } from "./BoardGamePage";
import { AppLayout } from "./layout/AppLayout";
import { DevNotesPage } from "./pages/DevNotesPage";
import { LandingPage } from "./pages/LandingPage";
import { MatchHistoryPage } from "./pages/MatchHistoryPage";
import { SHARED_BOARD_ID, USE_SHARED_ROOM } from "./constants";

export default function App() {
  if (USE_SHARED_ROOM) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppLayout />}>
          <Route
            path="/tablero"
            element={<BoardGamePage sharedMode forcedBoardId={SHARED_BOARD_ID} />}
          />
          <Route path="/dev-notes" element={<DevNotesPage />} />
          <Route path="/match-history" element={<MatchHistoryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<BoardGamePage />} />
        <Route path="/dev-notes" element={<DevNotesPage />} />
        <Route path="/match-history" element={<MatchHistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
