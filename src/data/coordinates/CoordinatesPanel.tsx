import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { VIEW_LIMITS, type CoordinateToolsProps } from '../../shared';
import {
  CoordinateError,
  convertCoordinates,
  coordinateTarget,
  formatSexagesimal,
} from './convert';
import './coordinates.css';

export function CoordinatesPanel({ view, onViewChange }: CoordinateToolsProps) {
  const id = useId();
  const raInput = useRef<HTMLInputElement>(null);
  const decInput = useRef<HTMLInputElement>(null);
  const [ra, setRA] = useState(() => formatSexagesimal(view.longitude, 'ra'));
  const [dec, setDec] = useState(() => formatSexagesimal(view.latitude, 'dec'));
  const [result, setResult] = useState('');
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState<'ra' | 'dec' | null>(null);

  useEffect(() => {
    setRA(formatSexagesimal(view.longitude, 'ra'));
    setDec(formatSexagesimal(view.latitude, 'dec'));
  }, [view.longitude, view.latitude]);

  const clearResult = () => {
    setResult('');
    setMessage('');
    setInvalid(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    clearResult();
    try {
      const converted = convertCoordinates(ra, dec);
      setResult(`RA:  ${converted.ra.toFixed(8)}°\nDec: ${converted.dec.toFixed(8)}°`);
      const target = coordinateTarget(converted.ra, converted.dec, view);
      if (target) {
        onViewChange(target);
        setMessage('Conversión completada. Visor orientado; zoom conservado.');
      } else {
        setMessage(
          `Conversión completada. El visor admite Dec entre −${VIEW_LIMITS.maxLatitude}° y +${VIEW_LIMITS.maxLatitude}°; la vista no se ha movido.`,
        );
      }
    } catch (error) {
      if (!(error instanceof CoordinateError)) throw error;
      setInvalid(error.field);
      setMessage(error.message);
      (error.field === 'ra' ? raInput : decInput).current?.focus();
    }
  };

  return (
    <form className="coordinate-tools" onSubmit={submit} noValidate>
      <label htmlFor={`${id}-ra`}>Ascensión recta · H M S</label>
      <input
        ref={raInput}
        id={`${id}-ra`}
        value={ra}
        type="text"
        placeholder="12 30 45.5"
        autoComplete="off"
        spellCheck={false}
        required
        aria-invalid={invalid === 'ra'}
        aria-describedby={`${id}-help ${id}-status`}
        onChange={(event) => {
          setRA(event.target.value);
          clearResult();
        }}
      />
      <label htmlFor={`${id}-dec`}>Declinación · ±D M S</label>
      <input
        ref={decInput}
        id={`${id}-dec`}
        value={dec}
        type="text"
        placeholder="-00 15 30"
        autoComplete="off"
        spellCheck={false}
        required
        aria-invalid={invalid === 'dec'}
        aria-describedby={`${id}-help ${id}-status`}
        onChange={(event) => {
          setDec(event.target.value);
          clearResult();
        }}
      />
      <p id={`${id}-help`} className="coordinate-help">
        Separa con espacios o dos puntos. RA: 0–23 h; Dec: ±90°.
      </p>
      <button className="plain-button coordinate-go" type="submit">
        GO
      </button>
      <label htmlFor={`${id}-result`}>Resultado GO · grados decimales</label>
      <textarea
        id={`${id}-result`}
        value={result}
        readOnly
        rows={2}
        placeholder={'RA:  —\nDec: —'}
        aria-describedby={`${id}-status`}
      />
      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={invalid ? 'coordinate-status coordinate-error' : 'coordinate-status'}
      >
        {message}
      </p>
      <p className="coordinate-help">
        Centro de imagen: RA {view.longitude.toFixed(8)}° · Dec {view.latitude.toFixed(8)}°. Marco
        ecuatorial ICRS (referencia J2000).
      </p>
    </form>
  );
}
