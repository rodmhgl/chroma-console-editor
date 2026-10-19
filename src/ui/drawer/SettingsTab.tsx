import { useId, type ReactNode } from 'react';
import { SEND_GAP_RANGE, useEditorStore } from '../../store/editorStore';
import { STORAGE_STATUS_HELP, STORAGE_STATUS_LABELS, UPDATE_WAITING_HELP, useAppStore } from '../../store/appStore';
import { isTheme, THEMES, UI_SCALE_RANGE, useSettingsStore } from '../../store/settingsStore';

const UI_SCALE_STEP = 5;

type ControlProps = { id: string; 'aria-describedby': string };

/** One setting: its name labels the control `children` renders, and its help describes it. */
function Setting({ label, help, children }: { label: string; help: string; children(props: ControlProps): ReactNode }) {
  const id = useId();
  return (
    <div className="setting">
      <span className="setting-text">
        <label className="setting-label" htmlFor={id}>
          {label}
        </label>
        <span className="setting-help" id={`${id}-help`}>
          {help}
        </span>
      </span>
      {children({ id, 'aria-describedby': `${id}-help` })}
    </div>
  );
}

/** The editor's own settings. None of them is sent to the pedal. */
export function SettingsTab() {
  const { theme, uiScale, update } = useSettingsStore();
  const { sendGapMs, setSendGapMs } = useEditorStore();

  return (
    <div className="settings-tab">
      <Setting label="Theme" help="The editor’s colours.">
        {(props) => (
          <select {...props} value={theme} onChange={(e) => isTheme(e.target.value) && update({ theme: e.target.value })}>
            {Object.entries(THEMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </Setting>
      <Setting label="UI scale" help="On top of the layout’s own fit to the window.">
        {(props) => (
          <span className="setting-control">
            <input
              {...props}
              type="range"
              min={UI_SCALE_RANGE.min}
              max={UI_SCALE_RANGE.max}
              step={UI_SCALE_STEP}
              value={uiScale}
              onChange={(e) => update({ uiScale: e.target.valueAsNumber })}
            />
            <output className="setting-value">{uiScale}%</output>
          </span>
        )}
      </Setting>
      <Setting label="Send All gap" help="The pause between Send All messages. Raise it if the pedal misses some.">
        {(props) => (
          <span className="setting-control">
            <input
              {...props}
              type="number"
              min={SEND_GAP_RANGE.min}
              max={SEND_GAP_RANGE.max}
              value={sendGapMs}
              onChange={(e) => {
                const ms = e.target.valueAsNumber;
                if (Number.isInteger(ms) && ms >= SEND_GAP_RANGE.min && ms <= SEND_GAP_RANGE.max) setSendGapMs(ms);
              }}
            />
            ms
          </span>
        )}
      </Setting>
      <AppSection />
    </div>
  );
}

/** The installed app: its version, whether the browser keeps its storage, Install, and Reload for a waiting update. */
function AppSection() {
  const { storage, installable, installed, updateWaiting, install, reload } = useAppStore();
  return (
    <section className="settings-section" aria-labelledby="settings-app">
      <h3 id="settings-app" className="settings-heading">
        App
      </h3>
      <Setting label="Version" help="The editor’s version.">
        {(props) => (
          <output {...props} className="setting-value">
            {__APP_VERSION__}
          </output>
        )}
      </Setting>
      <Setting label="Storage" help={STORAGE_STATUS_HELP[storage]}>
        {(props) => (
          <output {...props} className="setting-value">
            {storage === 'unknown' ? '…' : STORAGE_STATUS_LABELS[storage]}
          </output>
        )}
      </Setting>
      {installable && !installed && (
        <Setting label="Install app" help="Its own window and icon, and it opens offline.">
          {(props) => (
            <button {...props} type="button" className="bar-button" onClick={() => void install()}>
              Install
            </button>
          )}
        </Setting>
      )}
      {updateWaiting && (
        <Setting label="Reload to update" help={UPDATE_WAITING_HELP}>
          {(props) => (
            <button {...props} type="button" className="bar-button" onClick={reload}>
              Reload
            </button>
          )}
        </Setting>
      )}
    </section>
  );
}
