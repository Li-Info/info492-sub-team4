import {
  project,
  teamMembers,
  thesisStatement,
  paperSummary,
  fullPaperUrl,
  datasetDescription,
  datasetSources,
  experimentPlans,
} from './content.js';
import './App.css';

export default function App() {
  return (
    <main className="page">
      <header className="project-header">
        <p className="course">{project.course} · {project.team}</p>
        <h1>{project.title}</h1>
        <a
          className="paper-link"
          href="https://info492-team4-demo1.web.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Try Demo 1
        </a>
      </header>

      <nav className="section-nav" aria-label="Section navigation">
        <a href="#role">Team Role</a>
        <a href="#thesis">Thesis</a>
        <a href="#summary">Paper Summary</a>
        <a href="#experiments">Experiments</a>
      </nav>

      <div className="card-grid">
        <section className="card team-card" aria-labelledby="team-heading">
          <h2 id="team-heading">1. Team Members and Roles</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => (
                <tr key={member.name}>
                  <td>{member.name}</td>
                  <td>{member.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="role" className="card role-card" aria-labelledby="role-heading">
          <h2 id="role-heading">2. Team Role</h2>
          <p className="role-badge">{project.role}</p>
        </section>

        <section id="thesis" className="card thesis-card" aria-labelledby="thesis-heading">
          <h2 id="thesis-heading">3. Thesis Statement</h2>
          <p>{thesisStatement}</p>
        </section>

        <section id="summary" className="card summary-card" aria-labelledby="summary-heading">
          <h2 id="summary-heading">4. Summary of the 500-Word Paper</h2>
          <p>{paperSummary}</p>
          {fullPaperUrl && (
            <a
              className="paper-link"
              href={fullPaperUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read full paper
            </a>
          )}
          <div className="dataset">
            <h3>Dataset</h3>
            <p>{datasetDescription}</p>
            <ul className="dataset-sources">
              {datasetSources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="experiments"
          className="card experiments-card"
          aria-labelledby="experiments-heading"
        >
          <h2 id="experiments-heading">5. Four-Experiment Plan</h2>
          {experimentPlans.length > 0 && (
            <ol className="experiment-list" role="list">
              {experimentPlans.map((plan) => (
                <li key={plan.title}>
                  <h3>{plan.title}</h3>
                  <p>{plan.description}</p>
                  <p className="experiment-metrics">
                    <strong>Metrics:</strong> {plan.metrics}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
