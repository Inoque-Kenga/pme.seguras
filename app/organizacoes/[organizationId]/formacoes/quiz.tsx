"use client";

import { useState, useTransition } from "react";
import { submitQuizAction } from "./actions";

type QuizQuestion = {
  id: string;
  pergunta: string;
  opcoes: string[];
};

type QuizResult = {
  score: number;
  passed: boolean;
  validoAte: string | null;
};

export function QuizForm({
  organizationId,
  completionId,
  questions,
}: {
  organizationId: string;
  completionId: string;
  questions: QuizQuestion[];
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const allAnswered = answers.every((answer) => answer !== null);

  function submit() {
    setError("");
    startTransition(async () => {
      const response = await submitQuizAction({
        organizationId,
        completionId,
        answers: answers.map((answer) => answer ?? -1),
      });
      if (!response.ok) {
        setError(response.error.message);
        return;
      }
      setResult({
        score: response.data.score,
        passed: response.data.passed,
        validoAte: response.data.validoAte ? response.data.validoAte.toISOString() : null,
      });
    });
  }

  if (result) {
    return (
      <section
        className={`rounded-xl border p-6 ${
          result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className={`text-lg font-bold ${result.passed ? "text-emerald-900" : "text-amber-900"}`}>
          {result.passed ? "🎉 Parabéns — aprovado!" : "Quase lá — não foi desta."}
        </p>
        <p className={`mt-2 text-sm leading-6 ${result.passed ? "text-emerald-800" : "text-amber-800"}`}>
          A sua pontuação: <strong>{result.score}%</strong> (mínimo para aprovação: 70%).
          {result.passed && result.validoAte && (
            <>
              {" "}
              Formação válida até{" "}
              {new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date(result.validoAte))}.
            </>
          )}
          {!result.passed && " Pode rever o conteúdo e tentar novamente."}
        </p>
        {!result.passed && (
          <button
            onClick={() => {
              setResult(null);
              setAnswers(questions.map(() => null));
            }}
            className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
            type="button"
          >
            Tentar novamente
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Questionário ({questions.length} perguntas)</h2>
      <p className="mt-1 text-sm text-slate-500">Aprovação com pelo menos 70% de respostas corretas.</p>

      <div className="mt-5 space-y-6">
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">
              {questionIndex + 1}. {question.pergunta}
            </legend>
            <div className="mt-2 space-y-2">
              {question.opcoes.map((opcao, optionIndex) => (
                <label
                  key={optionIndex}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    answers[questionIndex] === optionIndex
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                  }`}
                >
                  <input
                    checked={answers[questionIndex] === optionIndex}
                    className="size-4"
                    name={`q-${question.id}`}
                    onChange={() =>
                      setAnswers((current) => current.map((value, index) => (index === questionIndex ? optionIndex : value)))
                    }
                    type="radio"
                  />
                  {opcao}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      <button
        onClick={submit}
        disabled={!allAnswered || isPending}
        className="mt-5 h-10 rounded-lg bg-blue-800 px-5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50"
        type="button"
      >
        {isPending ? "A avaliar..." : "Submeter respostas"}
      </button>
    </section>
  );
}
