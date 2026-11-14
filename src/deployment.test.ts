import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deployment contract', () => {
  const frontendRoot = process.cwd();
  const backendRoot = resolve(frontendRoot, '../AutoID');
  const frontendDockerfile = readFileSync(resolve(frontendRoot, 'Dockerfile'), 'utf8');
  const backendDockerfile = readFileSync(resolve(backendRoot, 'Dockerfile.backend'), 'utf8');
  const compose = readFileSync(resolve(backendRoot, 'docker-compose.yml'), 'utf8');
  const entrypoint = readFileSync(resolve(backendRoot, 'entrypoint.sh'), 'utf8');

  it('uses reproducible frontend dependencies and no missing seed database', () => {
    expect(frontendDockerfile).toContain('RUN npm ci');
    expect(backendDockerfile).not.toContain('export_for_docker.db');
    expect(entrypoint).not.toContain('seed.db');
  });

  it('fails closed when the production signing key is missing', () => {
    expect(compose).toContain('JWT__SIGNINGKEY=${ONLINEFS_JWT_SIGNING_KEY:?');
    expect(compose).toContain('./data:/app/data');
  });
  it('re-resolves Docker backend addresses in both application proxies', () => {
    for (const root of [frontendRoot, backendRoot]) {
      const config = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
      expect(config).toContain('resolver 127.0.0.11 valid=10s');
      expect(config).toContain('server backend:5000 resolve;');
      expect(config).toContain('proxy_pass http://autoid_backend/api/;');
      expect(config).toContain('proxy_pass http://autoid_backend/hubs/;');
    }
  });
  it('excludes credential-bearing queries from both proxy access logs and hub error logs', () => {
    for (const root of [frontendRoot, backendRoot]) {
      const config = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
      const format = config.slice(config.indexOf('log_format onlinefs_safe'), config.indexOf(';', config.indexOf('log_format onlinefs_safe')));
      expect(format).toContain('$request_method $uri $server_protocol');
      expect(format).not.toMatch(/\$request\b|\$request_uri\b|\$args\b|\$http_referer\b|\$http_authorization\b|\$http_cookie\b/);
      expect(config).toContain('access_log /dev/stdout onlinefs_safe;');
      expect(config.slice(config.indexOf('location /hubs/'))).toContain('error_log /dev/null;');
    }
  });
});
