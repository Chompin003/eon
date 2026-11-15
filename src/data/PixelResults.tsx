import { useMemo } from 'react';
import { OBJECT_STYLES, type PixelStudy, type FITSSource, type DetectionTrack } from '../shared';
interface Props {
  result: PixelStudy;
  source?: FITSSource;
  selected?: string;
  onSelected: (id: string) => void;
  visible: boolean;
  onVisible: (value: boolean) => void;
  onFrame: (id: string) => void;
}
function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PixelResults({
  result,
  source,
  selected,
  onSelected,
  visible,
  onVisible,
  onFrame,
}: Props) {
  const current = result.frames.find((f) => f.frameId === source?.id);
  const tracks = useMemo(() => new Map(result.tracks.map((t) => [t.id, t])), [result]);
  const track = tracks.get(selected ?? '');
  const listed = useMemo(
    () =>
      [...result.tracks]
        .sort((a, b) => b.measurements.length - a.measurements.length)
        .slice(0, 500),
    [result],
  );
  const options = track && !listed.some((t) => t.id === track.id) ? [...listed, track] : listed;
  const measurements = (entry: DetectionTrack | undefined) =>
    entry?.measurements.flatMap((m) => {
      const frame = result.frames.find((f) => f.frameId === m.frameId),
        d = frame?.detections.find((d) => d.id === m.detectionId);
      return frame && d ? [{ frame, d }] : [];
    }) ?? [];
  const values = measurements(track);
  const active = values.find((v) => v.frame.frameId === source?.id);
  const valid = values.filter((v) => v.d.apertureMean !== undefined);
  const x0 = valid[0]?.frame.mjd ?? 0,
    x1 = valid.at(-1)?.frame.mjd ?? x0;
  const low = Math.min(...valid.map((v) => v.d.apertureMean!)),
    high = Math.max(...valid.map((v) => v.d.apertureMean!));
  const csv = () => {
    const rows = [
      [
        'track',
        'frame',
        'date_utc',
        'ra_deg',
        'dec_deg',
        'aperture_mean',
        'rms_error_mean',
        'unit',
        'peak_background_subtracted',
        'fwhm_equivalent_arcsec',
        'flags',
        'aperture_flags',
        'association',
        'catalog_candidates',
      ],
    ];
    for (const t of result.tracks)
      for (const { frame, d } of measurements(t))
        rows.push([
          t.id,
          frame.frameId,
          frame.dateUtc,
          String(d.longitude),
          String(d.latitude),
          String(d.apertureMean ?? ''),
          String(d.apertureError ?? ''),
          frame.bunit,
          String(d.peak),
          String(d.fwhmArcsec),
          String(d.flags),
          String(d.apertureFlags),
          d.association,
          d.candidates.map((c) => c.name).join('; '),
        ]);
    const escape = (s: string) =>
      '"' +
      (/^[=+@-]/.test(s) && !/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s) ? "'" : '') +
      s.replaceAll('"', '""') +
      '"';
    download(
      'eon-mediciones.csv',
      'text/csv;charset=utf-8',
      rows.map((r) => r.map(escape).join(',')).join('\r\n'),
    );
  };
  return (
    <div className="pixel-results">
      <div className="section-title">
        <h3>Fuentes detectadas en los píxeles</h3>
        <span>SEP</span>
      </div>
      <p className="survey-details" data-testid="pixel-summary">
        {result.frames.length} exposiciones analizadas · {result.tracks.length} grupos posicionales
        · {result.seconds.toFixed(1)} s.
      </p>
      {result.failures.length > 0 && (
        <details>
          <summary>{result.failures.length} exposiciones no analizables</summary>
          {result.failures.map((f) => (
            <p key={f.frameId}>
              {f.frameId}: {f.message}
            </p>
          ))}
        </details>
      )}
      {(result.omittedFrames > 0 || result.frames.some((f) => f.truncated)) && (
        <p role="alert" className="scientific-notice">
          Análisis parcial: límite de 96 exposiciones y 500 detecciones por región y fecha. Se
          conservan las de mayor pico cuando se supera el límite. {result.omittedFrames} fechas
          quedaron fuera.
        </p>
      )}
      <label className="study-toggle">
        <input type="checkbox" checked={visible} onChange={(e) => onVisible(e.target.checked)} />{' '}
        Mostrar detecciones
      </label>
      <p className="survey-details">
        {current
          ? `${current.detections.length}${current.detectedCount && current.detectedCount > current.detections.length ? ` de ${current.detectedCount}` : ''} detecciones en ${current.dateUtc.slice(0, 19).replace('T', ' ')} UTC. Fondo ${current.background.toPrecision(4)}; RMS ${current.noise.toPrecision(3)} ${current.bunit}.`
          : 'Esta fecha no está en el análisis. Abre una de las exposiciones analizadas para ver sus marcas.'}
      </p>
      <label htmlFor="pixel-track">Explorar fuente detectada</label>
      <select
        id="pixel-track"
        className="survey-select"
        value={selected ?? ''}
        onChange={(e) => onSelected(e.target.value)}
      >
        <option value="">Elige una detección</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id} · {t.measurements.length} exposiciones
          </option>
        ))}
      </select>
      {result.tracks.length > 500 && (
        <p className="survey-details">
          Se listan los 500 grupos con más mediciones. La exportación incluye todos los grupos.
        </p>
      )}
      {track && (
        <div className="study-details">
          <strong>
            {track.id} ·{' '}
            {active ? OBJECT_STYLES[active.d.category].label : 'Sin detección en esta fecha'}
          </strong>
          {active && (
            <>
              <p>
                Centroide medido: RA {active.d.longitude.toFixed(7)}° · Dec{' '}
                {active.d.latitude.toFixed(7)}°.
              </p>
              <p>
                Extensión aparente: FWHM equivalente {active.d.fwhmArcsec.toFixed(2)}″.{' '}
                {active.d.area} píxeles segmentados.
              </p>
              <p>
                Apertura de 2.5 píxeles: {active.d.apertureMean?.toPrecision(5) ?? 'sin medida'} ±{' '}
                {active.d.apertureError?.toPrecision(3) ?? '—'} {active.frame.bunit} sobre el fondo.
                Error estimado solo con el RMS local.
              </p>
              <p>
                Calidad SEP: {active.d.flags === 0 ? 'sin banderas' : `banderas ${active.d.flags}`}{' '}
                · apertura: {active.d.apertureFlags}.
              </p>
              <p>
                {active.d.association === 'candidate'
                  ? 'Una asociación candidata por posición; identidad sin confirmar.'
                  : active.d.association === 'ambiguous'
                    ? 'Asociación ambigua: se mantiene sin clasificar.'
                    : 'Sin contraparte en los catálogos consultados.'}
              </p>
              {active.d.candidates.length > 0 && (
                <ul>
                  {active.d.candidates.map((c) => (
                    <li key={c.id}>
                      {c.name} · {c.provider} · {c.distanceArcsec.toFixed(2)}″
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {valid.length > 0 && (
            <figure className="measurement-figure">
              <figcaption>Señal en apertura por exposición · {valid[0].frame.bunit}</figcaption>
              <svg
                viewBox="0 0 280 115"
                role="img"
                aria-label="Mediciones instrumentales entre exposiciones; bandas no homogéneas"
              >
                <path d="M30 8V92H270" stroke="#aaa" fill="none" />
                {valid.map(({ frame, d }) => {
                  const x = 35 + ((frame.mjd - x0) / Math.max(x1 - x0, 1e-9)) * 228,
                    y = 82 - ((d.apertureMean! - low) / Math.max(high - low, 1e-8)) * 64;
                  return (
                    <circle
                      key={frame.frameId}
                      cx={x}
                      cy={y}
                      r={frame.frameId === source?.id ? 4 : 3}
                      fill={frame.frameId === source?.id ? '#2383e2' : '#666'}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ver ${frame.dateUtc}`}
                      onClick={() => onFrame(frame.frameId)}
                      onKeyDown={(e) => {
                        if (['Enter', ' '].includes(e.key)) {
                          e.preventDefault();
                          onFrame(frame.frameId);
                        }
                      }}
                    >
                      <title>
                        {frame.dateUtc}: {d.apertureMean!.toPrecision(5)}
                      </title>
                    </circle>
                  );
                })}
                <text x="0" y="15">
                  {high.toPrecision(3)}
                </text>
                <text x="0" y="89">
                  {low.toPrecision(3)}
                </text>
                <text x="30" y="108">
                  {valid[0].frame.dateUtc.slice(0, 10)}
                </text>
                <text x="200" y="108">
                  {valid.at(-1)!.frame.dateUtc.slice(0, 10)}
                </text>
              </svg>
            </figure>
          )}
          <details>
            <summary>Mediciones y fechas</summary>
            <div className="measurement-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha UTC</th>
                    <th>Señal</th>
                    <th>Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {values.map(({ frame, d }) => (
                    <tr key={frame.frameId}>
                      <td>{frame.dateUtc.slice(0, 10)}</td>
                      <td>{d.apertureMean?.toPrecision(4) ?? '—'}</td>
                      <td>
                        <button className="text-button" onClick={() => onFrame(frame.frameId)}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
      <div className="time-actions">
        <button
          className="plain-button"
          onClick={() =>
            download('eon-analisis.json', 'application/json', JSON.stringify(result, null, 2))
          }
        >
          Exportar JSON
        </button>
        <button className="plain-button" onClick={csv}>
          Exportar CSV
        </button>
      </div>
      <p className="survey-details">
        Las marcas siguen centroides medidos en cada FITS. Un grupo enlaza vecinos más cercanos
        mutuos a menos de 6.15″, con margen de 1.5″ frente a otras coincidencias; no demuestra
        movimiento físico. No se separan mezclas no resueltas. Se usa un umbral de{' '}
        {result.parameters.threshold}σ y área mínima de 5 píxeles.
      </p>
      <p className="survey-details">
        Las longitudes de onda y la PSF cambian entre exposiciones. Esta gráfica no es una curva de
        luz a banda fija ni un espectro. No incluye correcciones de apertura ni incertidumbre
        instrumental completa; usa IMAGE sin FLAGS/VARIANCE. Las banderas mostradas son de SEP.
        Conserva el FITS original completo para análisis científico.
      </p>
    </div>
  );
}
