/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { z } from 'zod';

interface Env {
	AI: Ai;
	ACCESS_KEY: string;
}

const requestSchema = z.object({
	messages: z.array(
		z.object({
			role: z.enum(['user', 'system', 'assistant', 'tool']),
			content: z.string(),
		})
	),
});

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// checking for accesskey header
		const headers = new Headers(request.headers);
		const keyHeader = headers.get('x-access-key');
		if (keyHeader !== env.ACCESS_KEY) {
			return new Response('access denied', { status: 403 });
		}
		// parsing request
		let parsedData;
		try {
			const reqData = await request.json();
			parsedData = requestSchema.safeParse(reqData);

			if (!parsedData.success) {
				return new Response(JSON.stringify(parsedData.error), { status: 400 });
			}
		} catch (error) {
			return new Response('Request body error', { status: 400 });
		}

		const responseStream = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
			stream: true,
			messages: parsedData.data.messages,
			max_tokens: 1024,
		});
		return new Response(responseStream as ReadableStream, {
			headers: { 'content-type': 'text/event-stream' },
		});
	},
} satisfies ExportedHandler<Env>;
