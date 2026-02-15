import { Routes, Route } from 'react-router-dom';
import CreatePoll from './components/CreatePoll';
import PollView from './components/PollView';
import ExploreFeed from './components/ExploreFeed';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<CreatePoll />} />
        <Route path="/explore" element={<ExploreFeed />} />
        <Route path="/poll/:shareId" element={<PollView />} />
      </Routes>
    </div>
  );
}

export default App;
