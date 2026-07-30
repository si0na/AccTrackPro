import React, { useEffect, useMemo, useState } from 'react';
import { UserCog } from 'lucide-react';
import { FormField, FormModal, INPUT_CLS } from '@/components/ui';
import {
  serviceProviderApi,
  type ServiceProviderField,
  type ServiceProviderProfile,
  type UpdateServiceProviderProfileInput,
} from '@/api/crm.api';
import { isValidPhone, normalizePhone, PHONE_ERROR } from '@/utils/phone';

export interface ServiceProviderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Notified after a successful save so callers can refresh dependent data. */
  onSaved?: (profile: ServiceProviderProfile) => void;
}

/** The identity fields the modal can collect, in display order. */
const IDENTITY_FIELDS: ReadonlyArray<{ key: Exclude<ServiceProviderField, 'phone'>; label: string; type: string }> = [
  { key: 'name',        label: 'Name',           type: 'text'  },
  { key: 'department',  label: 'Department',     type: 'text'  },
  { key: 'designation', label: 'Designation',    type: 'text'  },
  { key: 'email',       label: 'Official Email', type: 'email' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldValues = Record<ServiceProviderField, string>;

const EMPTY_VALUES: FieldValues = { name: '', department: '', designation: '', email: '', phone: '' };

/**
 * Reusable Service Provider profile dialog. Phone is always editable (it lives
 * only on the stakeholder records). Every other required field is normally
 * derived from the user record; it is only rendered — as an editable required
 * input — when it is missing/blank on the user, so the modal asks exactly for
 * what's missing and nothing more. Used both for the first-time completion
 * prompt (after an account is created) and for later edits from the profile menu.
 */
export const ServiceProviderProfileModal: React.FC<ServiceProviderProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [values, setValues] = useState<FieldValues>(EMPTY_VALUES);
  // Identity fields to render (missing on the user). Phone always renders.
  const [missingIdentity, setMissingIdentity] = useState<Set<ServiceProviderField>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ServiceProviderField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Reload the profile every time the modal opens and decide which fields to ask.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setErrors({});
    setFormError(null);
    setLoading(true);
    serviceProviderApi
      .getMine()
      .then((p) => {
        if (cancelled) return;
        setValues({
          name:        p.name ?? '',
          department:  p.department ?? '',
          designation: p.designation ?? '',
          email:       p.email ?? '',
          phone:       p.phone ?? '',
        });
        setMissingIdentity(new Set((p.missingFields ?? []).filter((f) => f !== 'phone')));
      })
      .catch(() => {
        if (!cancelled) setFormError('Could not load your profile. Please try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const identityToShow = useMemo(
    () => IDENTITY_FIELDS.filter((f) => missingIdentity.has(f.key)),
    [missingIdentity],
  );

  const setField = (key: ServiceProviderField, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const validate = (): boolean => {
    const next: Partial<Record<ServiceProviderField, string>> = {};

    if (!isValidPhone(values.phone)) {
      next.phone = normalizePhone(values.phone) === '' ? 'Phone number is required' : PHONE_ERROR;
    }
    for (const f of identityToShow) {
      const val = values[f.key].trim();
      if (!val) {
        next[f.key] = `${f.label} is required`;
      } else if (f.key === 'email' && !EMAIL_RE.test(val)) {
        next.email = 'Enter a valid email address';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const payload: UpdateServiceProviderProfileInput = { phone: normalizePhone(values.phone) };
      for (const f of identityToShow) {
        payload[f.key] = values[f.key].trim();
      }
      const result = await serviceProviderApi.updateProfile(payload);
      onSaved?.(result);
      onClose();
    } catch {
      // Failure toast raised centrally by the API client; keep the modal open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title="My Service Provider Profile"
      icon={<UserCog className="w-4 h-4" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Save"
      isSubmitting={saving}
      maxWidth="max-w-md"
    >
      <p className="text-xs text-slate-500 mb-4">
        You are automatically registered as a Service Provider on the accounts you manage.
        {identityToShow.length > 0
          ? ' Please complete the details below so your Service Provider record is accurate.'
          : " Your name, department, designation and email come from your user profile — please add the phone number we don't have on file."}
      </p>

      {identityToShow.map((f) => (
        <FormField key={f.key} label={f.label} required>
          <input
            type={f.type}
            className={INPUT_CLS}
            value={values[f.key]}
            onChange={(e) => setField(f.key, e.target.value)}
            disabled={loading}
          />
          {errors[f.key] && <p className="text-xs text-red-600 font-medium mt-1">{errors[f.key]}</p>}
        </FormField>
      ))}

      <FormField label="Phone Number" required hint="Applied to all your Service Provider records.">
        <input
          type="tel"
          className={INPUT_CLS}
          value={values.phone}
          onChange={(e) => setField('phone', e.target.value)}
          placeholder={loading ? 'Loading…' : 'e.g. +919876543210'}
          disabled={loading}
          autoFocus
        />
        {errors.phone && <p className="text-xs text-red-600 font-medium mt-1">{errors.phone}</p>}
      </FormField>

      {formError && <p className="text-xs text-red-600 font-medium mt-2">{formError}</p>}
    </FormModal>
  );
};
