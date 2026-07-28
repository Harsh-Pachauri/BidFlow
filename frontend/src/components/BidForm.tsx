import { useState, type FormEvent } from "react";
import axios from "axios";
import { api } from "../lib/api";
import type { ApiErrorBody } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { FormField } from "./ui/FormField";
import { useToast } from "./ui/Toast";

interface BidFormProps {
  rfqId: number;
  onSubmitted: () => void;
}

export function BidForm({ rfqId, onSubmitted }: BidFormProps) {
  const { showToast } = useToast();
  const [carrierName, setCarrierName] = useState("");
  const [freightCharge, setFreightCharge] = useState("");
  const [originCharge, setOriginCharge] = useState("");
  const [destinationCharge, setDestinationCharge] = useState("");
  const [transitTime, setTransitTime] = useState("");
  const [quoteValidityDays, setQuoteValidityDays] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/rfqs/${rfqId}/bids`, {
        carrierName,
        freightCharge: Number(freightCharge),
        originCharge: Number(originCharge),
        destinationCharge: Number(destinationCharge),
        transitTime,
        quoteValidityDays: Number(quoteValidityDays),
      });
      showToast("Bid submitted.", "success");
      setFreightCharge("");
      setOriginCharge("");
      setDestinationCharge("");
      onSubmitted();
    } catch (err) {
      const message = axios.isAxiosError<ApiErrorBody>(err) ? err.response?.data.error : undefined;
      showToast(message ?? "Failed to submit bid.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <FormField label="Carrier Name" htmlFor="carrierName">
        <Input id="carrierName" value={carrierName} onChange={(event) => setCarrierName(event.target.value)} required />
      </FormField>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Freight" htmlFor="freightCharge">
          <Input
            id="freightCharge"
            type="number"
            min="0"
            step="0.01"
            value={freightCharge}
            onChange={(event) => setFreightCharge(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Origin" htmlFor="originCharge">
          <Input
            id="originCharge"
            type="number"
            min="0"
            step="0.01"
            value={originCharge}
            onChange={(event) => setOriginCharge(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Destination" htmlFor="destinationCharge">
          <Input
            id="destinationCharge"
            type="number"
            min="0"
            step="0.01"
            value={destinationCharge}
            onChange={(event) => setDestinationCharge(event.target.value)}
            required
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Transit Time" htmlFor="transitTime" hint="e.g. 14 days">
          <Input id="transitTime" value={transitTime} onChange={(event) => setTransitTime(event.target.value)} required />
        </FormField>
        <FormField label="Quote Validity (days)" htmlFor="quoteValidityDays">
          <Input
            id="quoteValidityDays"
            type="number"
            min="1"
            step="1"
            value={quoteValidityDays}
            onChange={(event) => setQuoteValidityDays(event.target.value)}
            required
          />
        </FormField>
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        Submit Bid
      </Button>
    </form>
  );
}
