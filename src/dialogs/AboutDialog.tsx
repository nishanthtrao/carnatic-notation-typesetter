/*
 * About: credits for the original typesetter and this rebuild.
 * SPDX-License-Identifier: GPL-2.0-only
 */
import { Modal } from '../components/Modal';
import APP_ICON from '../assets/app-icon.png';

const VERSION = '3.0';

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      title="About"
      open={open}
      onClose={onClose}
      footer={
        <button type="button" className="primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="about">
        <img className="about-icon" src={APP_ICON} alt="" />
        <h3>Carnatic Notation Typesetter</h3>
        <p className="about-version">Version {VERSION}</p>

        <section>
          <h4>Created by Arun K</h4>
          <p>
            The <i>Carnatic Music Notation Typesetter</i>, including its input format, was designed and written by{' '}
            <b>Arun K</b> and published as free software under the GNU GPL v2.
          </p>
          <ul>
            <li>
              <a href="https://sourceforge.net/projects/cmnt/" target="_blank" rel="noopener noreferrer">Original project on SourceForge</a>
            </li>
            <li>
              <a href="http://arunk.freepgs.com/wordpress/cm-typesetter/about/" target="_blank" rel="noopener noreferrer">Arun K's page about the typesetter</a>
            </li>
          </ul>
        </section>

        <section>
          <h4>This version</h4>
          <p>
            This is an <b>unofficial, community-maintained rebuild</b>, made so the typesetter keeps working in today's browsers. It is not
            affiliated with or endorsed by Arun K. It reads the same input format, so notation written for the original works unchanged.
          </p>
          <ul>
            <li>
              <a href="https://github.com/nishanthtrao/carnatic-notation-typesetter" target="_blank" rel="noopener noreferrer">Source code on GitHub</a>
              {' · '}
              <a href="https://github.com/nishanthtrao/carnatic-notation-typesetter/blob/main/NOTICE.md" target="_blank" rel="noopener noreferrer">
                Credits and changes
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h4>Install and use offline</h4>
          <p>
            Once opened, the typesetter works without internet. To keep it on your home screen or dock: in Chrome or Edge use the{' '}
            <b>Install</b> button (or the install icon in the address bar); on an iPhone or iPad tap <b>Share → Add to Home Screen</b>; in
            Safari on a Mac choose <b>File → Add to Dock</b>.
          </p>
        </section>

        <p className="about-small">
          Free software under the GNU General Public License, version 2. Fonts: Noto Serif, Anek, Nunito and Baloo (SIL Open Font License).
        </p>
      </div>
    </Modal>
  );
}
