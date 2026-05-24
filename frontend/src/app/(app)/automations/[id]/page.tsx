"use client";

import { use } from "react";
import SequenceEditor from "@/components/SequenceEditor";

export default function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SequenceEditor id={id} />;
}
