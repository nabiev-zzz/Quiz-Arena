import { jest } from "@jest/globals";
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityLearningService } from './community-learning.service';
import { CommunityStorageService } from './community-storage.service';
import { ZcWalletService } from './zc-wallet.service';

describe('CommunityLearningService', () => {
  const manager = { query: jest.fn() };
  const db = {
    query: jest.fn(),
    transaction: jest.fn((callback: (value: typeof manager) => unknown) => callback(manager)),
  };
  const storage = { sign: jest.fn(() => 'https://media.example/signed') };
  const wallet = { credit: jest.fn().mockResolvedValue({}) };
  let service: CommunityLearningService;

  beforeEach(() => {
    jest.clearAllMocks();
    db.transaction.mockImplementation((callback: (value: typeof manager) => unknown) => callback(manager));
    service = new CommunityLearningService(db as unknown as DataSource, storage as unknown as CommunityStorageService, wallet as unknown as ZcWalletService);
  });

  it('rejects empty questions before touching the database', async () => {
    await expect(service.createQuestion('user-1', { subject: 'Fizika', title: ' ', body: 'Savol' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects joining a private group without an invitation', async () => {
    db.query.mockResolvedValueOnce([{ id: 'group-1', visibility: 'private' }]);
    await expect(service.joinGroup('user-2', 'group-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('creates a group and automatically registers its owner', async () => {
    manager.query.mockResolvedValueOnce([{ id: 'group-1', name: 'Matematika', subject: 'Matematika' }]).mockResolvedValueOnce([]);
    const result = await service.createGroup('owner-1', { name: 'Matematika', subject: 'Matematika' });
    expect(result.id).toBe('group-1');
    expect(manager.query).toHaveBeenCalledTimes(2);
    expect(manager.query.mock.calls[1][0]).toContain('community_group_members');
  });

  it('awards XP and idempotent ZC only after the question author accepts an answer', async () => {
    manager.query
      .mockResolvedValueOnce([{ id: 'question-1', author_id: 'owner-1', best_answer_id: null }])
      .mockResolvedValueOnce([{ id: 'answer-1', author_id: 'helper-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await service.acceptAnswer('owner-1', 'question-1', 'answer-1');
    expect(result).toEqual({ accepted: true, answerId: 'answer-1', xpAwarded: 15, zcAwarded: 5 });
    expect(wallet.credit).toHaveBeenCalledWith('helper-1', 5, 'Hamjamiyatdagi eng yaxshi javob', 'community-best-answer:answer-1');
  });

  it('retries the same accepted answer reward without granting XP twice', async () => {
    manager.query.mockResolvedValueOnce([{id:'question-1',author_id:'owner-1',best_answer_id:'answer-1'}]).mockResolvedValueOnce([{id:'answer-1',author_id:'helper-1'}]);
    const result=await service.acceptAnswer('owner-1','question-1','answer-1');
    expect(result).toEqual({accepted:true,answerId:'answer-1',xpAwarded:0,zcAwarded:5});
    expect(wallet.credit).toHaveBeenCalledWith('helper-1',5,'Hamjamiyatdagi eng yaxshi javob','community-best-answer:answer-1');
    expect(manager.query).toHaveBeenCalledTimes(2);
  });

  it('does not let a user reward their own answer', async () => {
    manager.query
      .mockResolvedValueOnce([{ id: 'question-1', author_id: 'owner-1', best_answer_id: null }])
      .mockResolvedValueOnce([{ id: 'answer-1', author_id: 'owner-1' }]);
    await expect(service.acceptAnswer('owner-1', 'question-1', 'answer-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallet.credit).not.toHaveBeenCalled();
  });

  it('awards group-task XP only on the first completion', async () => {
    db.query.mockResolvedValueOnce([{group_id:'group-1'}]).mockResolvedValueOnce([{id:'member-1'}]).mockResolvedValueOnce([{id:'completion-1'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{completed_count:1}]);
    const result=await service.completeGroupTask('learner-1','task-1');
    expect(result).toEqual({completed:true,completedCount:1,xpAwarded:2});
    expect(db.query.mock.calls[2][0]).toContain('ON CONFLICT DO NOTHING');
    expect(db.query.mock.calls[3][0]).toContain('xp=xp+2');
  });

  it('keeps marathon progress self-reported and does not mint rewards', async () => {
    db.query.mockResolvedValueOnce([{progress:40}]);
    const result=await service.updateMarathonProgress('learner-1','marathon-1',40);
    expect(result).toEqual({progress:40,xpAwarded:0,zcAwarded:0});
    expect(db.query.mock.calls[0][0]).toContain('GREATEST(progress,$1)');
    expect(wallet.credit).not.toHaveBeenCalled();
  });

  it('rejects a library file key that escapes the authenticated user folder', async () => {
    await expect(service.createResource('user-1',{title:'PDF',subject:'Fizika',fileKey:'community/user-1/../../other/secret.pdf',fileType:'application/pdf'})).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a question attachment that does not use a generated media key', async () => {
    await expect(service.createQuestion('user-1',{subject:'Fizika',title:'Savol',body:'Tafsilot',mediaKey:'community/user-1/../secret.pdf',mediaType:'application/pdf'})).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects ratings outside the one-to-five range', async () => {
    await expect(service.rateResource('user-1', 'resource-1', 6)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
