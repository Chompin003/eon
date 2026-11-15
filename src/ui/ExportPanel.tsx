import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExportLayers } from '../shared';

export interface ExportRequest {
  format: 'png' | 'gif';
  layers: ExportLayers;
  maxSide: number;
  signal: AbortSignal;
  progress: (message: string) => void;
}
interface Props {
  onExport: (request: ExportRequest) => Promise<string>;
  readyFrames: number;
  totalFrames: number;
  markersAvailable: boolean;
}
export function ExportPanel({ onExport, readyFrames, totalFrames, markersAvailable }: Props) {
  const [format, setFormat] = useState<'png' | 'gif'>('png');
  const [layers, setLayers] = useState<ExportLayers>({
    space: true,
    annotations: true,
    markers: true,
  });
  const [maxSide, setMaxSide] = useState(768);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (busy) dialog.current?.showModal();
  }, [busy]);
  const cancel = () => controller.current?.abort();
  const run = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setError('');
    setMessage('');
    setBusy(true);
    setProgress('Preparando exportación…');
    try {
      const filename = await onExport({
        format,
        layers: { ...layers, space: format === 'gif' || layers.space },
        maxSide: format === 'gif' ? maxSide : 4096,
        signal: abort.signal,
        progress: setProgress,
      });
      setMessage(`Descargado: ${filename}`);
    } catch (error) {
      if (abort.signal.aborted) setMessage('Exportación cancelada.');
      else setError(error instanceof Error ? error.message : 'No se pudo crear el archivo.');
    } finally {
      if (controller.current === abort) controller.current = undefined;
      setBusy(false);
    }
  };
  const empty = !layers.space && !layers.annotations && (!layers.markers || !markersAvailable);
  return (
    <section className="control-section export-tools" aria-labelledby="export-heading">
      <div className="section-title">
        <h2 id="export-heading">Descargar vista</h2>
      </div>
      <div className="display-modes" aria-label="Formato de descarga">
        <button
          className="plain-button"
          aria-pressed={format === 'png'}
          onClick={() => setFormat('png')}
        >
          Imagen PNG
        </button>
        <button
          className="plain-button"
          aria-pressed={format === 'gif'}
          onClick={() => setFormat('gif')}
        >
          Animación GIF
        </button>
      </div>
      <fieldset className="export-layers">
        <legend>Capas incluidas</legend>
        {(['space', 'annotations', 'markers'] as const).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={key === 'space' && format === 'gif' ? true : layers[key]}
              disabled={
                busy ||
                (key === 'space' && format === 'gif') ||
                (key === 'markers' && !markersAvailable)
              }
              onChange={(event) =>
                setLayers((current) => ({ ...current, [key]: event.target.checked }))
              }
            />
            {
              {
                space: 'Imagen del espacio',
                annotations: 'Anotaciones',
                markers: 'Marcadores del análisis',
              }[key]
            }
          </label>
        ))}
        <button
          className="text-button"
          onClick={() => setLayers({ space: true, annotations: true, markers: true })}
        >
          Todas las capas
        </button>
      </fieldset>
      {format === 'png' ? (
        <p className="survey-details">
          Sin la imagen del espacio, el PNG tiene fondo transparente. Se exporta el visor sin los
          controles.
        </p>
      ) : (
        <>
          <label className="export-resolution">
            Lado máximo del GIF
            <select value={maxSide} onChange={(e) => setMaxSide(Number(e.target.value))}>
              <option value={512}>512 px</option>
              <option value={768}>768 px</option>
              <option value={1024}>1024 px</option>
            </select>
          </label>
          <p className="survey-details">
            {readyFrames} de {totalFrames} fechas preparadas. Se exportan todas las preparadas, en
            orden, con el intervalo de reproducción actual y fecha UTC visible. Las pendientes o
            fallidas quedan fuera.
          </p>
          {readyFrames > 200 && (
            <p role="alert">
              El GIF admite hasta 200 fechas. Reduce el rango temporal antes de exportar.
            </p>
          )}
          {readyFrames < 2 && (
            <p className="survey-details">
              Prepara una animación de región con al menos dos fechas para crear el GIF.
            </p>
          )}
        </>
      )}
      <button
        className="plain-button"
        disabled={busy || (format === 'png' ? empty : readyFrames < 2 || readyFrames > 200)}
        onClick={() => void run()}
      >
        {format === 'png' ? 'Descargar PNG' : 'Descargar GIF'}
      </button>
      <p className="survey-details">
        Nombre: coordenadas J2000 (RA h m s / Dec ±d m s)
        {format === 'gif' ? ' y rango de fechas UTC.' : '.'}
      </p>
      {!markersAvailable && (
        <p className="survey-details">Interpreta una región para incluir sus marcadores.</p>
      )}
      {message && (
        <p className="export-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="export-message" role="alert">
          {error}
        </p>
      )}
      {busy &&
        createPortal(
          <dialog
            ref={dialog}
            className="export-dialog"
            aria-labelledby="export-progress-heading"
            onCancel={(event) => {
              event.preventDefault();
              cancel();
            }}
          >
            <h2 id="export-progress-heading">{format === 'gif' ? 'Creando GIF' : 'Creando PNG'}</h2>
            <p role="status" aria-live="polite">
              {progress}
            </p>
            <p className="survey-details">
              La reproducción está pausada. Mantén esta pestaña abierta.
            </p>
            <button className="plain-button" onClick={cancel} autoFocus>
              Cancelar exportación
            </button>
          </dialog>,
          document.body,
        )}
    </section>
  );
}
