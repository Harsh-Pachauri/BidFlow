import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../lib/api";
import type { ApiErrorBody, TriggerType } from "../types";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { FormField } from "../components/ui/FormField";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError<ApiErrorBody>(err)) return fallback;
  const data = err.response?.data;
  const details = data?.details as { fieldErrors?: Record<string, string[]> } | undefined;
  const fieldMessage = details?.fieldErrors && Object.values(details.fieldErrors).flat().find(Boolean);
  return fieldMessage ?? data?.error ?? fallback;
}

export function CreateRfqPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [referenceId, setReferenceId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [bidStartAt, setBidStartAt] = useState("");
  const [bidCloseAt, setBidCloseAt] = useState("");
  const [forcedCloseAt, setForcedCloseAt] = useState("");
  const [triggerWindowMin, setTriggerWindowMin] = useState("15");
  const [extensionMin, setExtensionMin] = useState("10");
  const [triggerType, setTriggerType] = useState<TriggerType>("ANY_BID");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await api.post<{ id: number }>("/rfqs", {
        referenceId,
        pickupDate: new Date(pickupDate).toISOString(),
        bidStartAt: new Date(bidStartAt).toISOString(),
        bidCloseAt: new Date(bidCloseAt).toISOString(),
        forcedCloseAt: new Date(forcedCloseAt).toISOString(),
        triggerWindowMin: Number(triggerWindowMin),
        extensionMin: Number(extensionMin),
        triggerType,
      });
      showToast("RFQ created.", "success");
      navigate(`/rfqs/${response.data.id}`);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to create RFQ."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold text-slate-900">Create RFQ</h1>
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Auction Details</h2>
        </CardHeader>
        <CardBody>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <FormField label="Reference ID" htmlFor="referenceId">
              <Input
                id="referenceId"
                value={referenceId}
                onChange={(event) => setReferenceId(event.target.value)}
                placeholder="RFQ-2026-006"
                required
              />
            </FormField>
            <FormField label="Pickup / Service Date" htmlFor="pickupDate">
              <Input
                id="pickupDate"
                type="date"
                value={pickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
                required
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Bid Start" htmlFor="bidStartAt">
                <Input
                  id="bidStartAt"
                  type="datetime-local"
                  value={bidStartAt}
                  onChange={(event) => setBidStartAt(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="Bid Close" htmlFor="bidCloseAt">
                <Input
                  id="bidCloseAt"
                  type="datetime-local"
                  value={bidCloseAt}
                  onChange={(event) => setBidCloseAt(event.target.value)}
                  required
                />
              </FormField>
              <FormField label="Forced Close" htmlFor="forcedCloseAt">
                <Input
                  id="forcedCloseAt"
                  type="datetime-local"
                  value={forcedCloseAt}
                  onChange={(event) => setForcedCloseAt(event.target.value)}
                  required
                />
              </FormField>
            </div>

            <div className="border-t border-slate-200 pt-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="mt-1 h-5 w-1 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">British Auction Configuration</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Controls when and how the auction automatically extends near its close time.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Trigger Window (min)" htmlFor="triggerWindowMin">
                  <Input
                    id="triggerWindowMin"
                    type="number"
                    min="1"
                    value={triggerWindowMin}
                    onChange={(event) => setTriggerWindowMin(event.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Extension (min)" htmlFor="extensionMin">
                  <Input
                    id="extensionMin"
                    type="number"
                    min="1"
                    value={extensionMin}
                    onChange={(event) => setExtensionMin(event.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Extension Trigger" htmlFor="triggerType">
                  <Select
                    id="triggerType"
                    value={triggerType}
                    onChange={(event) => setTriggerType(event.target.value as TriggerType)}
                  >
                    <option value="ANY_BID">Any new bid</option>
                    <option value="ANY_RANK_CHANGE">Any rank change</option>
                    <option value="L1_CHANGE_ONLY">L1 change only</option>
                  </Select>
                </FormField>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={isSubmitting} className="mt-2">
              Create RFQ
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
