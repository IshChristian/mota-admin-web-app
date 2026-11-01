import { KycFieldEditor } from './KycFieldEditor';

const DRIVER_FIELDS = ['nationalIdNumber', 'nationalIdFront', 'nationalIdBack', 'selfie', 'drivingLicenseNumber', 'drivingLicenseDocument', 'drivingLicenseExpiresAt', 'transportPermitNumber', 'transportPermitDocument', 'transportPermitExpiresAt', 'insuranceDocument', 'insuranceExpiresAt', 'vehicleRegistrationDocument', 'vehicleRegistrationExpiresAt', 'technicalInspectionDocument', 'technicalInspectionExpiresAt', 'vocationalCardDocument', 'vocationalCardExpiresAt', 'plateNumber', 'vehicleType', 'powertrain', 'cooperativeName'];
const PASSENGER_FIELDS = ['nationalIdNumber', 'nationalIdFront', 'nationalIdBack', 'selfie', 'dateOfBirth', 'residentialAddress', 'emergencyContactName', 'emergencyContactPhone'];
const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const isDate = (key: string) => /ExpiresAt$|^dateOfBirth$/.test(key);

/** All KYC values for one user, each editable in place (file upload, dates, text). */
export function KycRecordEditor({ type, kyc, canEdit, onSaved }: { type: 'driver' | 'passenger'; kyc: Record<string, any>; canEdit: boolean; onSaved: (message: string) => void }) {
  const fields = type === 'driver' ? DRIVER_FIELDS : PASSENGER_FIELDS;
  const now = Date.now();
  return (
    <article className="rounded-2xl border border-white/10 bg-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{type === 'driver' ? 'Driver' : 'Passenger'} verification data</h3>
        <span className="text-sm text-slate-400">Status: {String(kyc.status || '—')} · updated {kyc.updatedAt ? new Date(kyc.updatedAt).toLocaleString() : '—'}</span>
      </div>
      {!canEdit ? <p className="mt-2 text-sm text-slate-400">Editing needs the kyc:approve permission.</p> : null}
      <div className="mt-4 space-y-3">
        {fields.map((key) => {
          const value = kyc[key];
          const expired = isDate(key) && key.endsWith('ExpiresAt') && value && new Date(value).getTime() <= now;
          return (
            <div key={key} className="rounded-xl border border-white/10 p-4">
              <p className="text-sm font-semibold">{label(key)}</p>
              <p className={`mt-1 break-words text-sm ${expired ? 'text-red-300' : 'text-slate-300'}`}>
                {value == null || value === '' ? 'Not provided' : isDate(key) ? `${String(value).slice(0, 10)}${expired ? ' · expired' : ''}` : String(value)}
              </p>
              {typeof value === 'string' && /^https:\/\//i.test(value) ? <a href={value} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-lime underline">Open file ↗</a> : null}
              <KycFieldEditor key={`${key}-${kyc.updatedAt}`} type={type} recordId={String(kyc._id)} field={key} value={value} record={kyc} updatedAt={kyc.updatedAt} canEdit={canEdit} onSaved={(_record, message) => onSaved(message)} />
            </div>
          );
        })}
      </div>
    </article>
  );
}
